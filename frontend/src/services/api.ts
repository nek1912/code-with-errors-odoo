import axios from "axios";
import type {
  AuthResponse,
  ApiError,
  AssetListResponse,
  Asset,
  AssetDetail,
  AssetRegisterPayload,
  Category,
  Department,
  AllocationStatusResponse,
  AllocationItem,
  Transfer,
  TransferCreatePayload,
  AllocationCreatePayload,
  Employee,
  BookableResource,
  BookingDetail,
  Booking,
  BookingCreatePayload,
  BookingUpdatePayload,
  MaintenanceDetail,
  MaintenanceRequest,
  MaintenanceCreatePayload,
  MaintenanceStatusUpdatePayload,
  AuditCycle,
  AuditCycleDetail,
  AuditCycleCreatePayload,
  AuditItem,
  AuditItemUpdatePayload,
  AuditCycleCloseResult,
  ReportsOverview,
  NotificationItem,
  NotificationListResponse,
  UnreadCountResponse,
  ActivityLogEntry,
  ActivityLogListResponse,
} from "@/lib/types";

const API_BASE = "/api";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Attach token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 and auto-refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        try {
          const { data } = await axios.post<AuthResponse>(
            `${API_BASE}/auth/refresh`,
            { refresh_token: refreshToken },
            { headers: { "Content-Type": "application/json" } }
          );
          localStorage.setItem("access_token", data.access_token);
          localStorage.setItem("refresh_token", data.refresh_token);
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
          return api(originalRequest);
        } catch {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export async function signup(data: {
  full_name: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await api.post("/auth/signup", data);
  return res.data;
}

export async function login(data: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await api.post("/auth/login", data);
  return res.data;
}

export async function forgotPassword(data: {
  email: string;
}): Promise<{ message: string }> {
  const res = await api.post("/auth/forgot-password", data);
  return res.data;
}

export async function getMe() {
  const res = await api.get("/auth/me");
  return res.data;
}

export async function logout(): Promise<{ message: string }> {
  const res = await api.post("/auth/logout");
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  return res.data;
}

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiError | undefined;
    return data?.detail || error.message || "An error occurred";
  }
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred";
}

// ── Asset API ──────────────────────────────────────────────────

export interface AssetDirectoryParams {
  search?: string;
  category_id?: string;
  status?: string;
  department_id?: string;
  page?: number;
  limit?: number;
}

export async function getAssets(
  params: AssetDirectoryParams = {}
): Promise<AssetListResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.category_id) query.set("category_id", params.category_id);
  if (params.status) query.set("status", params.status);
  if (params.department_id) query.set("department_id", params.department_id);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  const res = await api.get<AssetListResponse>(`/assets${qs ? `?${qs}` : ""}`);
  return res.data;
}

export async function getAssetDetail(id: string): Promise<AssetDetail> {
  const res = await api.get<AssetDetail>(`/assets/${id}`);
  return res.data;
}

export async function registerAsset(
  data: AssetRegisterPayload
): Promise<Asset> {
  const res = await api.post<Asset>("/assets", data);
  return res.data;
}

export async function updateAssetStatus(
  id: string,
  newStatus: string
): Promise<Asset> {
  const res = await api.patch<Asset>(`/assets/${id}/status`, {
    status: newStatus,
  });
  return res.data;
}

// ── Dropdown data ──────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  const res = await api.get<Category[]>("/categories");
  return res.data;
}

export async function getDepartments(): Promise<Department[]> {
  const res = await api.get<Department[]>("/departments");
  return res.data;
}

// ── Allocation API ─────────────────────────────────────────────

export async function getAllocationStatus(
  assetId: string
): Promise<AllocationStatusResponse> {
  const res = await api.get<AllocationStatusResponse>(
    `/allocations/asset-status/${assetId}`
  );
  return res.data;
}

export async function createAllocation(
  data: AllocationCreatePayload
): Promise<AllocationItem> {
  const res = await api.post<AllocationItem>("/allocations", data);
  return res.data;
}

export async function returnAsset(
  allocationId: string,
  conditionNotes?: string
): Promise<AllocationItem> {
  const res = await api.post<AllocationItem>(
    `/allocations/${allocationId}/return`,
    { condition_notes: conditionNotes || null }
  );
  return res.data;
}

export async function getAssetAllocationHistory(
  assetId: string
): Promise<AllocationItem[]> {
  // Use the asset detail endpoint which returns allocation_history
  const detail = await getAssetDetail(assetId);
  return detail.allocation_history as unknown as AllocationItem[];
}

// ── Transfer API ───────────────────────────────────────────────

export async function createTransfer(
  data: TransferCreatePayload
): Promise<Transfer> {
  const res = await api.post<Transfer>("/transfers", data);
  return res.data;
}

export async function approveTransfer(
  transferId: string,
  conditionNotes?: string
): Promise<Transfer> {
  const res = await api.patch<Transfer>(`/transfers/${transferId}/approve`, {
    condition_notes: conditionNotes || null,
  });
  return res.data;
}

export async function rejectTransfer(transferId: string): Promise<Transfer> {
  const res = await api.patch<Transfer>(`/transfers/${transferId}/reject`);
  return res.data;
}

export async function getTransfers(
  status?: string
): Promise<Transfer[]> {
  const query = status ? `?asset_status=${status}` : "";
  const res = await api.get<Transfer[]>(`/transfers${query}`);
  return res.data;
}

// ── Employee API ───────────────────────────────────────────────

export async function getEmployees(): Promise<Employee[]> {
  const res = await api.get<Employee[]>("/employees");
  return res.data;
}

// ── Booking API ───────────────────────────────────────────────

export async function getBookableResources(): Promise<BookableResource[]> {
  const res = await api.get<BookableResource[]>("/resources/bookable");
  return res.data;
}

export async function getBookingsForDate(
  resourceId: string,
  date: string
): Promise<BookingDetail[]> {
  const res = await api.get<BookingDetail[]>("/bookings", {
    params: { resource_id: resourceId, date },
  });
  return res.data;
}

export async function createBooking(
  data: BookingCreatePayload
): Promise<Booking> {
  const res = await api.post<Booking>("/bookings", data);
  return res.data;
}

export async function updateBooking(
  bookingId: string,
  data: BookingUpdatePayload
): Promise<Booking> {
  const res = await api.patch<Booking>(`/bookings/${bookingId}`, data);
  return res.data;
}

export async function cancelBooking(bookingId: string): Promise<Booking> {
  const res = await api.patch<Booking>(`/bookings/${bookingId}`, {
    status: "CANCELLED",
  });
  return res.data;
}

// ── Maintenance API ───────────────────────────────────────────

export async function getMaintenanceRequests(): Promise<MaintenanceDetail[]> {
  const res = await api.get<MaintenanceDetail[]>("/maintenance");
  return res.data;
}

export async function createMaintenanceRequest(
  data: MaintenanceCreatePayload
): Promise<MaintenanceRequest> {
  const res = await api.post<MaintenanceRequest>("/maintenance", data);
  return res.data;
}

export async function updateMaintenanceStatus(
  requestId: string,
  data: MaintenanceStatusUpdatePayload
): Promise<MaintenanceDetail> {
  const res = await api.patch<MaintenanceDetail>(
    `/maintenance/${requestId}/status`,
    data
  );
  return res.data;
}

// ── Audit API ──────────────────────────────────────────────────

export async function getAuditCycles(): Promise<AuditCycle[]> {
  const res = await api.get<AuditCycle[]>("/audits");
  return res.data;
}

export async function getAuditCycleDetail(
  auditId: string
): Promise<AuditCycleDetail> {
  const res = await api.get<AuditCycleDetail>(`/audits/${auditId}`);
  return res.data;
}

export async function createAuditCycle(
  data: AuditCycleCreatePayload
): Promise<AuditCycleDetail> {
  const res = await api.post<AuditCycleDetail>("/audits", data);
  return res.data;
}

export async function updateAuditItem(
  auditId: string,
  itemId: string,
  data: AuditItemUpdatePayload
): Promise<AuditItem> {
  const res = await api.patch<AuditItem>(
    `/audits/${auditId}/items/${itemId}`,
    data
  );
  return res.data;
}

export async function closeAuditCycle(
  auditId: string
): Promise<AuditCycleCloseResult> {
  const res = await api.post<AuditCycleCloseResult>(`/audits/${auditId}/close`);
  return res.data;
}

// ── Reports API ────────────────────────────────────────────────

export async function getReportsOverview(): Promise<ReportsOverview> {
  const res = await api.get<ReportsOverview>("/reports/overview");
  return res.data;
}

// ── Notification API ───────────────────────────────────────────

export async function getNotifications(params: {
  filter_type?: string;
  unread_only?: boolean;
  page?: number;
  limit?: number;
} = {}): Promise<NotificationListResponse> {
  const query = new URLSearchParams();
  if (params.filter_type) query.set("filter_type", params.filter_type);
  if (params.unread_only) query.set("unread_only", "true");
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  const res = await api.get<NotificationListResponse>(
    `/notifications${qs ? `?${qs}` : ""}`
  );
  return res.data;
}

export async function getUnreadNotificationCount(): Promise<UnreadCountResponse> {
  const res = await api.get<UnreadCountResponse>("/notifications/unread-count");
  return res.data;
}

export async function markNotificationRead(
  id: string
): Promise<NotificationItem> {
  const res = await api.patch<NotificationItem>(`/notifications/${id}/read`);
  return res.data;
}

export async function markAllNotificationsRead(): Promise<{
  message: string;
  marked: number;
}> {
  const res = await api.post<{ message: string; marked: number }>(
    "/notifications/mark-all-read"
  );
  return res.data;
}

// ── Activity Log API ───────────────────────────────────────────

export async function getActivityLogs(params: {
  entity_type?: string;
  action_type?: string;
  user_id?: string;
  page?: number;
  limit?: number;
} = {}): Promise<ActivityLogListResponse> {
  const query = new URLSearchParams();
  if (params.entity_type) query.set("entity_type", params.entity_type);
  if (params.action_type) query.set("action_type", params.action_type);
  if (params.user_id) query.set("user_id", params.user_id);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  const res = await api.get<ActivityLogListResponse>(
    `/activity-logs${qs ? `?${qs}` : ""}`
  );
  return res.data;
}

export default api;
