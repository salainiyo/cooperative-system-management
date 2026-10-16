terraform {
  required_version = ">= 1.5.0"

  # Remote state on HCP Terraform (free tier: 500 managed resources).
  # State must outlive the machine it describes — never on the managed VM.
  # Auth: token from ~/.terraform.d/credentials.tfrc.json (terraform login)
  # locally, or the TF_TOKEN_app_terraform_io secret in GitHub Actions.
  cloud {
    organization = "salainiyo"
    workspaces {
      name = "coop-oci"
    }
  }

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 6.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
}
