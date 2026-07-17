import { canWorkStart } from "./domainHelpers";
import type { ChangeRequest, ClientPayment, Project, Scope, TimeEntry } from "../types/domain";

export type PricingQueueItem =
  | { type: "project"; project: Project }
  | { type: "change_request"; changeRequest: ChangeRequest };

export type ApprovalQueueItem =
  | { type: "project"; project: Project }
  | { type: "change_request"; changeRequest: ChangeRequest };

export type PaymentQueueItem =
  | { type: "project"; project: Project; payment?: ClientPayment }
  | { type: "payment"; payment: ClientPayment; project?: Project };

export function getNeedsPricingItems(projects: Project[], changeRequests: ChangeRequest[]): PricingQueueItem[] {
  const projectItems = projects
    .filter((project) => project.status === "waiting_for_agency_pricing")
    .map((project) => ({ type: "project" as const, project }));

  const changeItems = changeRequests
    .filter((request) =>
      request.status !== "declined" &&
      request.status !== "client_approved" &&
      (
        request.status === "agency_review" ||
        request.agencyPrice === undefined ||
        request.supplierCost === undefined
      ),
    )
    .map((changeRequest) => ({ type: "change_request" as const, changeRequest }));

  return [...projectItems, ...changeItems];
}

export function getWaitingApprovalItems(projects: Project[], changeRequests: ChangeRequest[]): ApprovalQueueItem[] {
  const projectItems = projects
    .filter((project) => project.status === "waiting_for_client_approval")
    .map((project) => ({ type: "project" as const, project }));

  const changeItems = changeRequests
    .filter((changeRequest) => changeRequest.status === "priced")
    .map((changeRequest) => ({ type: "change_request" as const, changeRequest }));

  return [...projectItems, ...changeItems];
}

export function getWaitingPaymentItems(projects: Project[], clientPayments: ClientPayment[]): PaymentQueueItem[] {
  const projectItems = projects
    .filter((project) => project.status === "waiting_for_payment")
    .map((project) => ({
      type: "project" as const,
      project,
      payment: clientPayments.find((payment) => payment.projectId === project.id),
    }));

  const paymentItems = clientPayments
    .filter((payment) => payment.status === "requested" || payment.status === "overdue")
    .map((payment) => ({
      type: "payment" as const,
      payment,
      project: projects.find((project) => project.id === payment.projectId),
    }));

  return [...projectItems, ...paymentItems];
}

export function getSupplierTimeApprovalItems(timeEntries: TimeEntry[]) {
  return timeEntries.filter((entry) => entry.status === "submitted");
}

export function getBlockedProjects(projects: Project[]) {
  return projects.filter((project) => project.paymentGateStatus === "blocked");
}

export function getReadyToStartProjects(projects: Project[], scopes: Scope[]) {
  return projects.filter((project) => canWorkStart(project, scopes) && project.status !== "completed");
}
