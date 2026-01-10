// apps/web/src/features/admin/api/customers.ts
import { http } from "@/api/http";

export type CustomerRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  createdAt: string;
};

export type CreateCustomerPayload = {
  code: string;
  name: string;
  status?: "active" | "inactive";
};

export type UpdateCustomerPayload = {
  code?: string;
  name?: string;
};

export async function listCustomers() {
  const res = await http.get("/admin/customers");
  return res.data as CustomerRow[];
}

export async function createCustomer(payload: CreateCustomerPayload) {
  const res = await http.post("/admin/customers", payload);
  return res.data as CustomerRow;
}

export async function updateCustomer(customerId: string, payload: UpdateCustomerPayload) {
  const res = await http.put(`/admin/customers/${customerId}`, payload);
  return res.data as { ok: boolean; customer: CustomerRow };
}

export async function setCustomerStatus(customerId: string, status: "active" | "inactive") {
  const res = await http.post(`/admin/customers/${customerId}/status`, { status });
  return res.data as { ok: boolean; status: string; workspacesDeactivated?: number; reportsDeactivated?: number };
}
