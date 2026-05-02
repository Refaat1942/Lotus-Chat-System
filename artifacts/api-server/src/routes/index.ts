import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import customersRouter from "./customers";
import conversationsRouter from "./conversations";
import messagesRouter from "./messages";
import tagsRouter from "./tags";
import quickRepliesRouter from "./quick-replies";
import analyticsRouter from "./analytics";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(customersRouter);
router.use(conversationsRouter);
router.use(messagesRouter);
router.use(tagsRouter);
router.use(quickRepliesRouter);
router.use(analyticsRouter);

export default router;
