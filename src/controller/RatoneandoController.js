import axios from 'axios';

class RatoneandoController {
  constructor() {}

  // Función para buscar producto en la API de Ratoneando
 async buscarProductoEnAPI(ean) {
    try {
      console.log(`Buscando producto en API Ratoneando con EAN: ${ean}`);
      const response = await axios.get(`https://go.ratoneando.ar/?q=${ean}`, {
        headers: {
          'Referer': 'https://ratoneando.ar/'
        }
      });

      const productos = response.data.products.slice(0, 15);
      if (productos.length === 0) {
        throw new Error("No se encontraron productos en la API de Ratoneando.");
      }

      console.log(`Productos encontrados en API Ratoneando: ${productos.map(producto => producto.name).join(', ')}`);
      return productos.map(producto => producto.name);
    } catch (error) {
      throw new Error(`No se pudo encontrar ningún ingrediente relacionado al siguiente código de barras: ${ean}`);
    }
  }
}

export default new RatoneandoController();