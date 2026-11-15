import { reportRepositoryContract } from "../test-support/report-repository.contract";
import { reportReviewStoreContract } from "../test-support/report-review-store.contract";
import { InMemoryReportRepository } from "./in-memory-report-repository";

reportRepositoryContract("InMemoryReportRepository", () => new InMemoryReportRepository());
reportReviewStoreContract("InMemoryReportRepository", () => new InMemoryReportRepository());
