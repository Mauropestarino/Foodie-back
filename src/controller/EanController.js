import { db } from "../connection/firebaseConnection.js";
import RatoneandoController from './RatoneandoController.js';
import GeminiController from './GeminiController.js';

class EanController {
  // Método para obtener el tipo de producto por EAN
  async obtenerTipoProductoPorEAN(req, res) {
    const { ean } = req.params;

    if (!ean) {
        console.log('EAN no proporcionado en la solicitud');
        return res.status(400).json({ error: 'EAN es requerido' });
    }

    let tipoProducto = null;

    try {
        console.log(`Buscando EAN: ${ean} en la colección eans`);

        const eanRef = db.collection("eans").doc(String(ean));
        const eanDoc = await eanRef.get();

        if (eanDoc.exists) {
            tipoProducto = eanDoc.data();
            console.log(`Producto encontrado: ${ean} con tipo: ${tipoProducto}`);
        } else {
            console.log("EAN no encontrado, llamando a la API de Ratoneando.");

            const nombresProductos = await RatoneandoController.buscarProductoEnAPI(ean);
            tipoProducto = await GeminiController.generarTipoDeProducto(nombresProductos);
            console.log(tipoProducto)
            if (!tipoProducto) {
                throw new Error("El tipo de producto no es válido.");
            }
        }

        if (tipoProducto) {
            const productoRef = db.collection("productos").doc(tipoProducto);
            const productoDoc = await productoRef.get();

            if (productoDoc.exists) {
                unidadMedida = productoDoc.data().unidadMedida;
            }
        }

        res.json( tipoProducto, unidadMedida );
    } catch (e) {
        console.error("Error al procesar el EAN: ", e.message);
        res.status(400).json({ error: `Error al procesar el EAN: ${e.message}` });
    }
  }
}

export default new EanController();
