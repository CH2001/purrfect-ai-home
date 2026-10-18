output "browser_config" {
  value = {
    VITE_APP_MODE             = "gcp"
    VITE_FIREBASE_API_KEY     = data.google_firebase_web_app_config.app.api_key
    VITE_FIREBASE_AUTH_DOMAIN = data.google_firebase_web_app_config.app.auth_domain
    VITE_FIREBASE_PROJECT_ID  = var.project_id
    VITE_FIREBASE_APP_ID      = google_firebase_web_app.app.app_id
  }
}
output "image_repository" { value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}/app" }
output "build_service_account" { value = google_service_account.builder.email }
output "build_source_bucket" { value = google_storage_bucket.source.name }
output "web_service_account" { value = google_service_account.web.email }
output "service_url" { value = try(google_cloud_run_v2_service.web[0].uri, null) }
output "worker_url" { value = try(google_cloud_run_v2_service.worker[0].uri, null) }
output "server_config" {
  value = local.server_environment
}
