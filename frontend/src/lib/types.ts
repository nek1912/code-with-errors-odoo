export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department_id: string | null;
  is_active: boolean;
  email_confirmed_at: string | null;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface ApiError {
  detail: string;
}

// ── Asset Types ────────────────────────────────────────────────

export interface Asset {
  id: string;
  asset_tag: string;
  name: string;
  serial_number: string | null;
  category_id: string | null;
  category_name: string | null;
  department_id: string | null;
  department_name: string | null;
  acquisition_date: string | null;
  acquisition_cost: number | null;
  condition: string;
  condition_notes: string | null;
  location: string | null;
  is_shared: boolean;
  photo_url: string | null;
  current_status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssetListResponse {
  items: Asset[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AssetRegisterPayload {
  name: string;
  serial_number?: string | null;
  category_id?: string | null;
  department_id?: string | null;
  acquisition_date?: string | null;
  acquisition_cost?: number | null;
  condition?: string;
  condition_notes?: string | null;
  location?: string | null;
  is_shared?: boolean;
  photo_url?: string | null;
}

export interface AllocationHistoryItem {
  id: string;
  user_id: string;
  user_name: string | null;
  department_name: string | null;
  allocated_at: string;
  expected_return_date: string | null;
  actual_return_date: string | null;
  status: string;
}

export interface MaintenanceHistoryItem {
  id: string;
  requested_by_user_id: string;
  requested_by_name: string | null;
  priority: string;
  issue_description: string;
  resolution_notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AssetDetail extends Asset {
  allocation_history: AllocationHistoryItem[];
  maintenance_history: MaintenanceHistoryItem[];
}

// ── Category & Department (for filter dropdowns) ───────────────

export interface Category {
  id: string;
  name: string;
}

export interface Department {
  id: string;
  name: string;
}

// ── Allocation Types ───────────────────────────────────────────

export interface AllocationStatusResponse {
  asset_id: string;
  asset_tag: string;
  asset_name: string;
  current_status: string;
  is_shared: boolean;
  is_allocated: boolean;
  current_holder: {
    user_id: string;
    user_name: string;
    department_name: string | null;
    allocated_at: string;
    expected_return_date: string | null;
  } | null;
  active_allocation_id: string | null;
}

export interface AllocationItem {
  id: string;
  asset_id: string;
  user_id: string;
  user_name: string | null;
  department_id: string | null;
  department_name: string | null;
  allocated_at: string;
  expected_return_date: string | null;
  actual_return_date: string | null;
  condition_notes: string | null;
  status: string;
  created_at: string;
}

// ── Transfer Types ─────────────────────────────────────────────

export interface Transfer {
  id: string;
  asset_id: string;
  asset_tag: string | null;
  asset_name: string | null;
  from_user_id: string;
  from_user_name: string | null;
  to_user_id: string;
  to_user_name: string | null;
  reason: string;
  status: string;
  requested_by: string;
  requested_by_name: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransferCreatePayload {
  asset_id: string;
  from_user_id: string;
  to_user_id: string;
  reason: string;
}

export interface AllocationCreatePayload {
  asset_id: string;
  user_id: string;
  department_id?: string | null;
  expected_return_date?: string | null;
  condition_notes?: string | null;
}

export interface Employee {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department_id: string | null;
  department_name: string | null;
  is_active: boolean;
  created_at: string;
}

// ── Booking Types ──────────────────────────────────────────────

export interface BookableResource {
  id: string;
  asset_tag: string;
  name: string;
  location: string | null;
  current_status: string;
}

export interface Booking {
  id: string;
  asset_id: string;
  user_id: string;
  title: string | null;
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
}

export interface BookingDetail extends Booking {
  user_name: string | null;
  department_name: string | null;
  asset_name: string | null;
  asset_tag: string | null;
}

export interface BookingCreatePayload {
  asset_id: string;
  start_time: string;
  end_time: string;
  title?: string;
}

export interface BookingUpdatePayload {
  start_time?: string;
  end_time?: string;
  status?: string;
  title?: string;
}

// ── Maintenance Types ──────────────────────────────────────────

export interface MaintenanceRequest {
  id: string;
  asset_id: string;
  requested_by_user_id: string;
  approved_by_user_id: string | null;
  assigned_technician_id: string | null;
  priority: string;
  status: string;
  issue_description: string;
  resolution_notes: string | null;
  previous_asset_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceDetail extends MaintenanceRequest {
  asset_tag: string | null;
  asset_name: string | null;
  requested_by_name: string | null;
  approved_by_name: string | null;
  assigned_technician_name: string | null;
}

export interface MaintenanceCreatePayload {
  asset_id: string;
  priority: string;
  issue_description: string;
}

export interface MaintenanceStatusUpdatePayload {
  new_status: string;
  assigned_technician_id?: string;
  resolution_notes?: string;
}

// ── Audit Types ────────────────────────────────────────────────

export interface AuditCycle {
  id: string;
  name: string;
  scope_type: string;
  scope_id: string | null;
  created_by_user_id: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AuditItem {
  id: string;
  audit_cycle_id: string;
  asset_id: string;
  auditor_user_id: string | null;
  physical_status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  asset_tag: string | null;
  asset_name: string | null;
  asset_location: string | null;
  auditor_name: string | null;
}

export interface AuditCycleDetail extends AuditCycle {
  items: AuditItem[];
  auditor_names: string[];
  scope_name: string | null;
  created_by_name: string | null;
}

export interface AuditCycleCreatePayload {
  name: string;
  scope_type: string;
  scope_id?: string;
  start_date: string;
  end_date: string;
  auditor_ids: string[];
}

export interface AuditItemUpdatePayload {
  physical_status: string;
  notes?: string;
}

export interface AuditCycleCloseResult {
  closed: boolean;
  assets_marked_lost: number;
  allocations_terminated: number;
  total_items: number;
  verified_count: number;
  missing_count: number;
  damaged_count: number;
}

// ── Report Types ───────────────────────────────────────────────

export interface DeptUtilization {
  dept_name: string;
  count: number;
}

export interface MaintenanceFrequency {
  month: string;
  count: number;
}

export interface MostUsedAsset {
  asset_tag: string;
  name: string;
  booking_count: number;
}

export interface IdleAsset {
  asset_tag: string;
  name: string;
  days_idle: number;
}

export interface RetirementAlert {
  asset_tag: string;
  name: string;
  reason: string;
}

export interface ReportsOverview {
  utilization_by_dept: DeptUtilization[];
  maintenance_frequency: MaintenanceFrequency[];
  most_used_assets: MostUsedAsset[];
  idle_assets: IdleAsset[];
  retirement_alerts: RetirementAlert[];
}

// ── Notification Types ──────────────────────────────────────────

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  total: number;
  unread_count: number;
}

export interface UnreadCountResponse {
  count: number;
}

// ── Activity Log Types ──────────────────────────────────────────

export interface ActivityLogEntry {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface ActivityLogListResponse {
  items: ActivityLogEntry[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
