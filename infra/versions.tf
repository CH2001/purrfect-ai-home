terraform {
  required_version = ">= 1.6, < 2.0"
  backend "gcs" {}
  required_providers {
    google      = { source = "hashicorp/google", version = "~> 7.0" }
    google-beta = { source = "hashicorp/google-beta", version = "~> 7.0" }
  }
}
provider "google" {
  project = var.project_id
  region  = var.region
}
provider "google-beta" {
  project = var.project_id
  region  = var.region
  # Firebase Auth requires an explicit consumer project for user ADC requests.
  user_project_override = true
  billing_project       = var.project_id
}
