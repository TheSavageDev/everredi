## Overview

This api uses **Jest + Supertest** for automated testing. The test suite is split into **unit**, **integration**, **e2e**, and **regression** tests.

## Test types

- **Unit tests**
  - **Scope**: A single class (service, guard, pipe, util) with all dependencies mocked.
  - **Location**: `src/**/__tests__/*.spec.ts` (for example `src/users/__tests__/users.service.spec.ts`).
  - **Examples**:
    - `AuthService` delegating to `UsersService`.
    - `UsersService` behavior with Supabase mocked.
    - `StripeService` wrapping Stripe SDK.

- **Integration tests**
  - **Scope**: Multiple Nest providers working together via Nest DI, without going through HTTP.
  - **Location**: Also under `src/**/__tests__/*.spec.ts`, but named accordingly (for example `ai.service.integration.spec.ts`).
  - **Examples**:
    - `AiService` + `UsersService` + a Supabase mock.

- **E2E tests**
  - **Scope**: Full HTTP stack (`Supertest` → controller → service → repository / external integrations (mocked)).
  - **Location**: `test/e2e/**/*.e2e-spec.ts`.
  - **Bootstrap**: All e2e tests create an in-memory `AppModule` via `test/utils/create-testing-app.ts`, which:
    - Applies the same global validation pipe and `api` prefix as `main.ts`.
    - Overrides `UsersService` to avoid depending on real Supabase data.

- **Regression tests**
  - **Scope**: Any test that explicitly guards against a previously observed bug (at either service or HTTP level).
  - **Conventions**:
    - Co-locate with the most relevant layer:
      - Service-level regressions go in the usual `__tests__` file near the service.
      - HTTP-level regressions go into an appropriate e2e spec.
    - Use a `describe('regression: <short description>')` block so intent is clear.
    - Optionally include ticket or issue ids in the test name.

## Folder structure

- **Unit / integration**
  - `src/app.controller.spec.ts` – example controller unit test.
  - `src/auth/__tests__/auth.service.spec.ts`
  - `src/users/__tests__/users.service.spec.ts`
  - `src/inventory/__tests__/expiration.service.spec.ts`
  - `src/notifications/__tests__/notifications.service.spec.ts`
  - `src/subscriptions/__tests__/stripe.service.spec.ts`
  - `src/ai/__tests__/ai.service.integration.spec.ts`
  - `src/compliance/__tests__/compliance.service.spec.ts`

- **E2E**
  - `test/app.e2e-spec.ts` – `/api/health` smoke test.
  - `test/e2e/auth-users.e2e-spec.ts` – `/api/auth/create-or-update`, `/api/users/me`.
  - `test/e2e/inventory.e2e-spec.ts` – basic inventory endpoints.
  - `test/e2e/ai.e2e-spec.ts` – `/api/ai/recommendations`.
  - `test/e2e/smoke.e2e-spec.ts` – one smoke endpoint per main controller (locations, supplies, notifications, kits, public templates, subscriptions, compliance, etc.).

## Running tests

- **All unit + integration tests**

  ```bash
  npm test
  ```

- **Watch mode**

  ```bash
  npm run test:watch
  ```

- **Coverage**

  ```bash
  npm run test:cov
  ```

- **E2E only**

  ```bash
  npm run test:e2e
  ```

## Test helpers and mocks

- **Shared Jest setup**
  - `test/jest.setup.ts` runs for both unit/integration and e2e:
    - Sets `NODE_ENV=test` and safe default env vars (`CORS_ORIGIN`, `FRONTEND_URL`, etc.).
    - Mocks external SDKs:
      - `@google/generative-ai`.
      - `stripe`.
      - `@google-cloud/tasks`.

- **Nest app bootstrap for e2e**
  - `test/utils/create-testing-app.ts`:
    - Imports `AppModule`.
    - Overrides:
      - `UsersService` with an in-memory implementation.
    - Applies global validation pipe and `api` prefix.
    - Returns `{ app, close }` to manage lifecycle in tests.

- **Auth utilities**
  - `test/utils/test-auth.ts`:
    - `TEST_USER_ID`, `TEST_USER_EMAIL`.
    - `TEST_AUTH_HEADER` with a bearer token used in e2e tests.

## Adding new tests

- **For a new service**
  - Create `src/<module>/__tests__/<name>.service.spec.ts`.
  - Instantiate the service directly with mocked dependencies (plain objects or Jest mocks).
  - Focus on business logic (inputs → outputs, side effects).

- **For a new controller endpoint**
  - Add or extend an existing e2e spec under `test/e2e`.
  - Use `createTestingApp()` and `TEST_AUTH_HEADER` to call the HTTP endpoint via Supertest.
  - Assert on status codes and the most important fields in the response body.

- **For a regression fix**
  - Before fixing the bug, write a failing test that reproduces the behavior:
    - If the bug is in a service: add a `describe('regression: ...')` block in the relevant `__tests__` file.
    - If the bug is at the HTTP level: add a similar regression `describe` block in the appropriate e2e file.
  - Confirm the test fails on the current code.
  - Implement the fix.
  - Confirm the new test passes.

## Expectations for new code

- New features should ship with:
  - At least one **unit** test for core business logic.
  - At least one **e2e** test for any new public HTTP endpoint.
- Bug fixes should always be accompanied by a **regression** test that would fail without the fix.
