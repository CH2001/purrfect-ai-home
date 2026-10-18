variable "project_id" { type = string }
variable "region" {
  type    = string
  default = "asia-southeast1"
}
variable "name" {
  type    = string
  default = "purrfect-home"
}
variable "deploy_services" {
  type    = bool
  default = false
}
variable "image" {
  type    = string
  default = ""
}
variable "gemini_model_id" {
  type        = string
  description = "Vertex model ID available to your project. Set explicitly; no model availability is assumed."
}
variable "vertex_location" {
  type    = string
  default = "global"
}
variable "authorized_domains" {
  type        = list(string)
  default     = ["localhost"]
  description = "Firebase Auth domains. Add the Cloud Run hostname after the first deployment."
}
variable "deletion_protection" {
  type    = bool
  default = true
}
variable "secret_environment" {
  description = "Optional future application secrets. Metadata only: add values with gcloud, never Terraform."
  type        = map(object({ secret_id = string, version = string }))
  default     = {}
  validation {
    condition     = alltrue([for key, value in var.secret_environment : can(regex("^[A-Z][A-Z0-9_]*$", key)) && can(regex("^[0-9]+$", value.version)) && !startswith(key, "VITE_") && !contains(["GOOGLE_APPLICATION_CREDENTIALS", "FIREBASE_AUTH_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST", "APP_MODE", "SERVICE_MODE", "GOOGLE_CLOUD_PROJECT", "GEMINI_MODEL_ID", "GCP_LOCATION", "AI_PROVIDER", "AI_DAILY_LIMIT", "DEMO_GUEST_ACCESS", "PORT"], key)])
    error_message = "Use a server-only environment name and a numeric secret version; reserved/authentication variables cannot be secrets."
  }
}
