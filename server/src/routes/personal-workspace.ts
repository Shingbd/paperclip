import { Router } from "express";
import type { Request } from "express";
import type { Db } from "@paperclipai/db";
import { personalTodoSchema } from "@paperclipai/shared";
import { z } from "zod";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { personalWorkspaceService } from "../services/personal-workspace.js";
import { forbidden } from "../errors.js";

export function personalWorkspaceRoutes(db: Db) {
  const router = Router();
  const service = personalWorkspaceService(db);
  function scope(req: Request) {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const userId = req.actor.userId ?? (req.actor.source === "local_implicit" ? "local-board" : null);
    if (!userId) throw forbidden("Human user identity required");
    return { companyId, userId };
  }
  const base = "/companies/:companyId/personal-todos";
  router.get(base, async (req, res) => {
    const { companyId, userId } = scope(req);
    res.json(await service.list(companyId, userId));
  });
  router.post(base, async (req, res) => {
    const { companyId, userId } = scope(req);
    res.status(201).json(await service.create(companyId, userId, personalTodoSchema.parse(req.body)));
  });
  router.put(`${base}/:todoId`, async (req, res) => {
    const { companyId, userId } = scope(req);
    const { revision, ...input } = req.body;
    res.json(await service.update(companyId, userId, req.params.todoId as string, personalTodoSchema.parse(input), z.string().min(1).parse(revision)));
  });
  router.post(`${base}/:todoId/complete`, async (req, res) => {
    const { companyId, userId } = scope(req);
    const { completed } = z.object({ completed: z.boolean() }).strict().parse(req.body);
    res.json(await service.complete(companyId, userId, req.params.todoId as string, completed));
  });
  router.post(`${base}/:todoId/archive`, async (req, res) => {
    const { companyId, userId } = scope(req);
    res.json(await service.archive(companyId, userId, req.params.todoId as string));
  });
  router.post(`${base}/:todoId/analyze`, async (req, res) => {
    const { companyId, userId } = scope(req);
    res.status(202).json(await service.requestAnalysis(companyId, userId, req.params.todoId as string));
  });
  for (const action of ["accept", "reject"] as const) {
    router.post(`${base}/:todoId/${action}`, async (req, res) => {
      const { companyId, userId } = scope(req);
      const { revision } = z.object({ revision: z.string().min(1) }).strict().parse(req.body);
      res.json(await service[action](companyId, userId, req.params.todoId as string, revision));
    });
  }
  return router;
}
