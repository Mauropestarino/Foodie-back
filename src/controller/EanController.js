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
    let ingrediente = null;

    try {
        console.log(`Buscando EAN: ${ean} en la colección eans`);

        const eanDoc = await db.collection("eans").doc(String(ean)).get();

        if (eanDoc.exists) { 
            let tipoEan = eanDoc.data().tipo;
            console.log(`Producto encontrado: ${ean} con tipo: ${tipoEan}`);

            const productoDoc = await db.collection("productos").doc(tipoEan).get();

            const productoData = productoDoc.data();
            console.log(productoData)
            ingrediente = {
                unidadMedida: productoData.unidadMedida,
                imageUrl: productoData.imageUrl,
                tipo: tipoEan
            };
            
        } else {
            console.log("EAN no encontrado, llamando a la API de Ratoneando.");

            const nombresProductos = await RatoneandoController.buscarProductoEnAPI(ean);
            tipoProducto = await GeminiController.generarTipoDeProducto(nombresProductos);
            console.log(tipoProducto)
            if (!tipoProducto) {
                throw new Error("El tipo de producto no es válido.");
            }else{
                ingrediente = tipoProducto;
            }
        }

        res.json( ingrediente );
    } catch (e) {
        console.error("Error al procesar el EAN: ", e.message);
        res.status(400).json({ error: `${e.message}` });
    }
  }
}

export default new EanController();
