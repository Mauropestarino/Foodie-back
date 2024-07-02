import express from "express";
import StockController from "../controller/StockController.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

//Rutas para agregar productos al stock
router.post("/confirmation", authMiddleware, StockController.confirmacionUsuario);
router.post("/manual", authMiddleware, StockController.agregarProductoPorNombre);

router.get("/", authMiddleware, StockController.obtenerStock);
router.get("/search", authMiddleware, StockController.buscarProductos);

router.put("/:nombreProducto", authMiddleware, StockController.actualizarProducto);
router.delete("/:nombreProducto", authMiddleware, StockController.eliminarProducto);

//Actualizacion de stock al puntuar receta
router.post("/consumir", authMiddleware, StockController.consumirProductos);

export default router;
