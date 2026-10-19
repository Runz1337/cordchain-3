import { Router, type IRouter } from "express";
import healthRouter from "./health";
import guildsRouter from "./guilds";
import checkinRouter from "./checkin";
import tradeRouter from "./trade";
import walletRouter from "./wallet";
import campaignsRouter from "./campaigns";

const router: IRouter = Router();

router.use(healthRouter);
router.use(guildsRouter);
router.use(checkinRouter);
router.use(tradeRouter);
router.use(walletRouter);
router.use(campaignsRouter);

export default router;
