export type BaseRole = "owner" | "admin" | "staff"
export type ContextRole = "owner" | "admin" | "staff" | "client"

export interface OrgPermissions {
  can_manage_spaces:        boolean
  can_invite_clients:       boolean
  can_invite_staff:         boolean
  can_manage_billing:       boolean
  can_manage_org_settings:  boolean
  can_view_all_spaces:      boolean
  can_manage_tasks:         boolean
  can_manage_meetings:      boolean
  can_upload_files:         boolean
  can_message:              boolean
}

export interface ClientCapabilities {
  can_view:          boolean
  can_upload:        boolean
  can_message:       boolean
  can_edit:          boolean
  can_delete:        boolean
  can_create_tasks:  boolean
  can_manage_tasks:  boolean
  can_delegate:      boolean
}

export interface OrgContext {
  context_type:     "org"
  context_id:       string
  org_id:           string
  org_name:         string
  base_role:        BaseRole
  context_role:     BaseRole
  custom_role_id?:  string
  custom_role_name?: string
  permissions:      OrgPermissions
  route:            string
  joined_at:        string
}

export interface ClientContext {
  context_type:   "client_space"
  context_id:     string
  space_id:       string
  space_name:     string
  org_id:         string
  org_name:       string
  context_role:   "client"
  capabilities:   ClientCapabilities
  client_name?:   string
  route:          string
  joined_at:      string
}

export type UserContext = OrgContext | ClientContext

export interface ContextsResponse {
  success:         boolean
  total:           number
  org_contexts:    OrgContext[]
  client_contexts: ClientContext[]
  routing:         "onboarding" | "auto_org" | "auto_client" | "switcher"
}
