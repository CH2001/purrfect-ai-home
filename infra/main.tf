locals {
  services = toset(["run.googleapis.com", "artifactregistry.googleapis.com", "cloudbuild.googleapis.com", "firestore.googleapis.com", "firebase.googleapis.com", "identitytoolkit.googleapis.com", "securetoken.googleapis.com", "aiplatform.googleapis.com", "secretmanager.googleapis.com", "cloudscheduler.googleapis.com", "logging.googleapis.com", "firebaserules.googleapis.com"])
  server_environment = {
    APP_MODE             = "gcp"
    GOOGLE_CLOUD_PROJECT = var.project_id
    AI_PROVIDER          = "vertex"
    GCP_LOCATION         = var.vertex_location
    GEMINI_MODEL_ID      = var.gemini_model_id
    AI_DAILY_LIMIT       = "40"
    DEMO_GUEST_ACCESS    = "true"
    NODE_ENV             = "production"
  }
}
resource "google_project_service" "api" {
  for_each           = local.services
  service            = each.value
  disable_on_destroy = false
}
resource "google_firebase_project" "app" {
  provider   = google-beta
  project    = var.project_id
  depends_on = [google_project_service.api]
}
resource "google_firebase_web_app" "app" {
  provider     = google-beta
  project      = var.project_id
  display_name = "Purrfect Home"
  depends_on   = [google_firebase_project.app]
}
data "google_firebase_web_app_config" "app" {
  provider   = google-beta
  project    = var.project_id
  web_app_id = google_firebase_web_app.app.app_id
}
resource "google_identity_platform_config" "auth" {
  provider           = google-beta
  project            = var.project_id
  authorized_domains = distinct(concat(var.authorized_domains, ["${var.project_id}.firebaseapp.com", "${var.project_id}.web.app"]))
  sign_in {
    allow_duplicate_emails = false
    email {
      enabled           = true
      password_required = true
    }
    anonymous { enabled = true }
  }
  depends_on = [google_firebase_project.app]
}
resource "google_firestore_database" "app" {
  project                           = var.project_id
  name                              = "(default)"
  location_id                       = var.region
  type                              = "FIRESTORE_NATIVE"
  delete_protection_state           = var.deletion_protection ? "DELETE_PROTECTION_ENABLED" : "DELETE_PROTECTION_DISABLED"
  point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_ENABLED"
  depends_on                        = [google_project_service.api]
}
resource "google_firebaserules_ruleset" "firestore" {
  project = var.project_id
  source {
    files {
      name    = "firestore.rules"
      content = file("${path.module}/../firestore.rules")
    }
  }
  depends_on = [google_firestore_database.app]
}
resource "google_firebaserules_release" "firestore" {
  project      = var.project_id
  name         = "cloud.firestore"
  ruleset_name = google_firebaserules_ruleset.firestore.name
}
resource "google_firestore_index" "reviews" {
  project    = var.project_id
  database   = google_firestore_database.app.name
  collection = "reviewDueIndex"
  fields {
    field_path = "remindersEnabled"
    order      = "ASCENDING"
  }
  fields {
    field_path = "nextReviewDueAt"
    order      = "ASCENDING"
  }
}
resource "google_firestore_field" "ai_usage_ttl" {
  project    = var.project_id
  database   = google_firestore_database.app.name
  collection = "aiUsage"
  field      = "expiresAt"
  ttl_config {}
}
resource "google_artifact_registry_repository" "app" {
  location      = var.region
  repository_id = var.name
  format        = "DOCKER"
  depends_on    = [google_project_service.api]
}
resource "google_storage_bucket" "source" {
  name                        = "${var.project_id}-${var.name}-build-source"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  lifecycle_rule {
    condition { age = 7 }
    action { type = "Delete" }
  }
}
resource "google_service_account" "web" { account_id = "${var.name}-web" }
resource "google_service_account" "worker" { account_id = "${var.name}-worker" }
resource "google_service_account" "scheduler" { account_id = "${var.name}-scheduler" }
resource "google_service_account" "builder" { account_id = "${var.name}-builder" }
resource "google_project_iam_member" "web" {
  for_each = toset(["roles/datastore.user", "roles/firebaseauth.viewer", "roles/aiplatform.user"])
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.web.email}"
}
resource "google_project_iam_member" "worker" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.worker.email}"
}
resource "google_artifact_registry_repository_iam_member" "builder" {
  location   = var.region
  repository = google_artifact_registry_repository.app.repository_id
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.builder.email}"
}
resource "google_project_iam_member" "builder_logs" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.builder.email}"
}
resource "google_storage_bucket_iam_member" "builder_source" {
  bucket = google_storage_bucket.source.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.builder.email}"
}
resource "google_secret_manager_secret" "optional" {
  for_each  = var.secret_environment
  secret_id = each.value.secret_id
  replication {
    auto {}
  }
  depends_on = [google_project_service.api]
}
resource "google_secret_manager_secret_iam_member" "web" {
  for_each  = var.secret_environment
  secret_id = google_secret_manager_secret.optional[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.web.email}"
}
resource "google_cloud_run_v2_service" "web" {
  count               = var.deploy_services ? 1 : 0
  name                = var.name
  location            = var.region
  deletion_protection = var.deletion_protection
  ingress             = "INGRESS_TRAFFIC_ALL"
  template {
    service_account                  = google_service_account.web.email
    timeout                          = "60s"
    max_instance_request_concurrency = 40
    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }
    containers {
      image = var.image
      ports { container_port = 8080 }
      resources {
        limits   = { cpu = "1", memory = "512Mi" }
        cpu_idle = true
      }
      startup_probe {
        http_get { path = "/health" }
      }
      dynamic "env" {
        for_each = local.server_environment
        content {
          name  = env.key
          value = env.value
        }
      }
      dynamic "env" {
        for_each = var.secret_environment
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.optional[env.key].secret_id
              version = env.value.version
            }
          }
        }
      }
    }
  }
  lifecycle {
    precondition {
      condition     = length(var.image) > 0
      error_message = "Build and push an image before deploy_services=true."
    }
  }
  depends_on = [google_project_iam_member.web, google_secret_manager_secret_iam_member.web, google_firebaserules_release.firestore]
}
resource "google_cloud_run_v2_service_iam_member" "public_web" {
  count    = var.deploy_services ? 1 : 0
  name     = google_cloud_run_v2_service.web[0].name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}
resource "google_cloud_run_v2_service" "worker" {
  count               = var.deploy_services ? 1 : 0
  name                = "${var.name}-worker"
  location            = var.region
  deletion_protection = var.deletion_protection
  ingress             = "INGRESS_TRAFFIC_ALL"
  template {
    service_account = google_service_account.worker.email
    timeout         = "300s"
    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }
    containers {
      image = var.image
      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }
      env {
        name  = "SERVICE_MODE"
        value = "worker"
      }
      startup_probe {
        http_get { path = "/health" }
      }
      resources {
        limits = { cpu = "1", memory = "512Mi" }
      }
    }
  }
  depends_on = [google_project_iam_member.worker]
}
resource "google_cloud_run_v2_service_iam_member" "scheduler" {
  count    = var.deploy_services ? 1 : 0
  name     = google_cloud_run_v2_service.worker[0].name
  location = var.region
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler.email}"
}
resource "google_cloud_scheduler_job" "reviews" {
  count            = var.deploy_services ? 1 : 0
  name             = "${var.name}-reviews"
  region           = var.region
  schedule         = "0 9 * * *"
  time_zone        = "Asia/Kuala_Lumpur"
  attempt_deadline = "300s"
  retry_config { retry_count = 3 }
  http_target {
    uri         = "${google_cloud_run_v2_service.worker[0].uri}/internal/reminders"
    http_method = "POST"
    oidc_token {
      service_account_email = google_service_account.scheduler.email
      audience              = google_cloud_run_v2_service.worker[0].uri
    }
  }
  depends_on = [google_cloud_run_v2_service_iam_member.scheduler, google_project_service.api]
}

