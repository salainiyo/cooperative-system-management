# ---------------------------------------------------------------------------
# OCI credentials / location (fill in terraform.tfvars — never committed)
# ---------------------------------------------------------------------------
variable "tenancy_ocid" {
  type        = string
  description = "OCID of the tenancy (Console → Administration → Tenancy details)."
}

variable "user_ocid" {
  type        = string
  description = "OCID of the IAM user that owns the API key (Console → Identity → Users)."
}

variable "fingerprint" {
  type        = string
  description = "Fingerprint of the API signing key."
}

variable "private_key_path" {
  type        = string
  description = "Path to the API signing private key (e.g. ~/.oci/oci_api_key.pem)."
}

variable "region" {
  type        = string
  description = "OCI region with an 'Always Free-eligible' badge (e.g. us-ashburn-1, eu-frankfurt-1, af-johannesburg-1)."
}

variable "ssh_public_key_path" {
  type        = string
  description = "Path to the SSH PUBLIC key installed on the instance (e.g. ~/.ssh/id_ed25519.pub)."
}

variable "ssh_private_key_path" {
  type        = string
  default     = "~/.ssh/id_ed25519"
  description = "Private key Ansible will use to reach the instance (recorded in the generated inventory)."
}

variable "availability_domain_name" {
  type        = string
  default     = ""
  description = "Optional explicit AD name (e.g. UzBZ:UK-LONDON-1-AD-3). Empty = first AD. The E2.1.Micro limit is per-AD, so this must name an AD with a free slot."
}

variable "compartment_ocid" {
  type        = string
  default     = ""
  description = "Optional compartment. Empty = build in the root (tenancy) compartment."
}

# ---------------------------------------------------------------------------
# ALWAYS FREE guardrails — these validations make over-provisioning impossible.
# Free tier allowance used by this config:
#   * 1 of max 2 VM.Standard.E2.1.Micro instances (AMD, 1/8 OCPU, 1 GB RAM)
#   * 50 GB of max 200 GB total boot volume
#   * VCN/subnet/IGW/routes/security lists/ephemeral public IP (free)
#   * deliberately NO: NAT gateway, load balancer, extra block volumes,
#     flexible (E4/E5) shapes, Ampere A1 — anything there would bill you.
# ---------------------------------------------------------------------------
variable "instance_shape" {
  type        = string
  default     = "VM.Standard.E2.1.Micro"
  description = "Fixed to the Always Free AMD micro shape. Do not change."

  validation {
    condition     = var.instance_shape == "VM.Standard.E2.1.Micro"
    error_message = "Only VM.Standard.E2.1.Micro is Always Free eligible on AMD. Any other shape starts billing you."
  }
}

variable "boot_volume_size_in_gbs" {
  type        = number
  default     = 50
  description = "Boot volume size (Always Free: min 47 GB, 200 GB total across the tenancy)."

  validation {
    condition     = var.boot_volume_size_in_gbs >= 47 && var.boot_volume_size_in_gbs <= 200
    error_message = "Boot volume must stay within 47-200 GB to remain Always Free (200 GB is the total tenancy allowance)."
  }
}

# ---------------------------------------------------------------------------
# Network
# ---------------------------------------------------------------------------
variable "vcn_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "subnet_cidr" {
  type    = string
  default = "10.0.1.0/24"
}

variable "instance_display_name" {
  type    = string
  default = "coop-free-vm"
}
