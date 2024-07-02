// routes/userRoutes.js
import express from "express";
import UserController from "../controller/UserController.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

router.post("/", UserController.crearUsuario);
router.post("/login", UserController.login);
router.get("/", authMiddleware, UserController.obtenerUsuario);
router.put("/update/restrictions", authMiddleware, UserController.actualizarRestriccionesUsuario);
router.delete("/", authMiddleware, UserController.eliminarUsuario);

export default router;
