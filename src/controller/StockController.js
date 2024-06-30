import { db } from "../connection/firebaseConnection.js";

class StockController {
  // Método para confirmar el producto por parte del usuario
  async confirmacionUsuario(req, res) {

    const userId = req.user.id;
    const { ean, tipoProducto, cantidad, unidad, alerta, unidadMedida } = req.body;
    console.log(`ean ${ean}`);
    console.log(`tipoProducto ${tipoProducto}`);
    console.log(`cantidad ${cantidad}`);
    console.log(`unidad ${unidad}`);
    console.log(`alerta ${alerta}`);
    console.log(`unidadMedida ${unidadMedida}`);

    /*if (!userId || !ean || !tipoProducto || !cantidad || !unidad ) {
      console.log("Datos incompletos en la solicitud");
      return res.status(400).json({ error: "Todos los campos son requeridos" });
    }*/

      if (!userId) {
        console.log("Falta el userId en la solicitud");
        return res.status(400).json({ error: "El campo userId es requerido" });
      }
      if (!ean) {
        console.log("Falta el ean en la solicitud");
        return res.status(400).json({ error: "El campo ean es requerido" });
      }
      if (!tipoProducto) {
        console.log("Falta el tipoProducto en la solicitud");
        return res.status(400).json({ error: "El campo tipoProducto es requerido" });
      }
      if (!cantidad) {
        console.log("Falta la cantidad en la solicitud");
        return res.status(400).json({ error: "El campo cantidad es requerido" });
      }
      if (!unidad) {
        console.log("Falta la unidad en la solicitud");
        return res.status(400).json({ error: "El campo unidad es requerido" });
      }
      let alarma;
      if (!alerta) {
        console.log("Alerta no seleccionada, asignando 0");
        alarma = 0;
       // return res.status(400).json({ error: "El campo alerta es requerido" });
      }else{ alarma = alerta }
      

    let nombreProducto = await formatText(tipoProducto);
        
    try {
      await validarValor(unidad);
      await validarValor(cantidad);

      console.log(`Confirmando EAN: ${ean} con tipo: ${nombreProducto}, cantidad: ${cantidad}, unidad: ${unidad} para el usuario: ${userId}`);

      const eanRef = db.collection("eans").doc(String(ean));
      const eanDoc = await eanRef.get();

      if (!eanDoc.exists) {
        await eanRef.set({
          tipo: tipoProducto,
          timestamp: new Date().toISOString(),
        });
        console.log(
          `Producto con EAN: ${ean} insertado en Firestore con tipo: ${nombreProducto}`
        );
      }

      const userStockRef = db
        .collection("usuarios")
        .doc(String(userId))
        .collection("stock")
        .doc(nombreProducto);
      const userStockDoc = await userStockRef.get();

      if (userStockDoc.exists) {
        const currentCantidad = userStockDoc.data().cantidad;
        await userStockRef.update({
          cantidad: currentCantidad + cantidad * unidad,
          ultimaCarga: new Date().toISOString(),
          alertaEscasez: alarma,
        });
        console.log(
          `Stock actualizado para el producto: ${nombreProducto} del usuario: ${userId} con nueva cantidad: ${
            currentCantidad + cantidad * unidad
          }`
        );
      } else {

        await userStockRef.set({
          cantidad: cantidad * unidad,
          ultimaCarga: new Date().toISOString(),
          unidadMedida: unidadMedida,
          alertaEscasez: alarma,
        });

        console.log(`Nuevo stock creado para el producto: ${nombreProducto} del usuario: ${userId} con: ${cantidad * unidad}  ${unidadMedida}`);
        }

      res.status(200).json({ message: "Confirmación exitosa" });
    } catch (e) {
      console.error("Error al confirmar el EAN: ", e.message);
      res
        .status(400)
        .json({ error: `Error al confirmar el EAN: ${e.message}` });
    }
  }

  async agregarProductoPorNombre(req, res) {
    const userId = req.userId;
    const { cantidad, nombreProducto, unidad, alerta } = req.body;

    try {
      await validarValor(unidad);
      await validarValor(cantidad);

      const cantAgregada = cantidad*unidad;

      const productoRef = db
        .collection("usuarios")
        .doc(String(userId))
        .collection("stock")
        .doc(nombreProducto);

      const docSnap = await productoRef.get();

      if (docSnap.exists) {
        await productoRef.update({
          cantidad: docSnap.cantidad + cantAgregada,
          ultimaCarga: new Date().toISOString(),
          alertaEscasez: alerta,
        });
      } else {
        const ingredienteSnapshot = await db.collection("productos").doc(nombreProducto);
        const ingredienteRef = await ingredienteSnapshot.get();
        const medicion = ingredienteRef.data().unidadMedida;

        await productoRef.set({ 
          cantidad: cantAgregada,
          unidadMedida: medicion,
          ultimaCarga,
          alertaEscasez: alerta,
        });
      }

      console.log(
        `Tipo de producto ${nombreProducto} añadido al stock del usuario ${userId}.`
      );
      res
        .status(201)
        .json({
          message: `Tipo de producto ${nombreProducto} añadido al stock.`,
        });
    } catch (e) {
      console.error(
        "Error al añadir el tipo de producto al stock: ",
        e.message
      );
      res.status(400).json({ error: e.message });
    }
  }

    async obtenerStock(req, res) {
    const userId = req.user.id;

    try {
      const stockSnapshot = await db
        .collection("usuarios")
        .doc(userId)
        .collection("stock")
        .get();
      if (stockSnapshot.empty) {
        return res.status(200).json([]); // Devuelve un array vacío si no hay documentos
      }

      const stock = await Promise.all(
        stockSnapshot.docs.map(async (doc) => {
          const productoData = doc.data();
          const productoDoc = await db
            .collection("productos")
            .doc(doc.id)
            .get();

          let imageUrl = null;
          let unidad = null;
          if (productoDoc.exists) {
            imageUrl = productoDoc.data().imageUrl || null;
            unidad = productoDoc.data().unidadMedida || null;
          }

          return {
            id: doc.id,
            ...productoData,
            imageUrl,
            unidad,
          };
        })
      );

      //console.log(stock); // Log para verificar los datos obtenidos

      res.status(200).json(stock);
    } catch (e) {
      console.error("Error al obtener el stock: ", e.message);
      res.status(500).json({ error: e.message });
    }
  }

  async buscarProductos(req, res) {
    const userId = req.user.id;
    const { nombreProducto }= req.query;

    console.log(nombreProducto)
    let nombre = formatText(nombreProducto);
    console.log(nombre)

    try {
      const productosRef = db.collection("productos");
      const querySnapshot = await productosRef.get();

      if (!querySnapshot.empty) {
        console.log("Documentos obtenidos de la colección productos:", querySnapshot.size);

        const productos = [];
        querySnapshot.forEach(doc => {

          // Verificar si alguna palabra dentro del ID del documento comienza con `nombreProducto`
          const words = doc.id.split(" ");
          for (let word of words) {
            if (word.toLowerCase().startsWith(nombreProducto.toLowerCase())) {
              console.log("Documento coincide con el criterio:", doc.id);
              productos.push({ id: doc.id, ...doc.data() });
              break; // Si encontramos una coincidencia, no necesitamos seguir verificando más palabras
            }
          }
        });

        if (productos.length > 0) {
          res.status(200).json(productos);
        } else {
          res.status(404).json({ error: "No se encontraron productos que coincidan con el criterio de búsqueda." });
        }
      } else {
        res.status(404).json({ error: "No se encontraron productos que coincidan con el criterio de búsqueda." });
      }
    } catch (e) {
      console.error("Error al obtener los productos: ", e.message);
      res.status(500).json({ error: e.message });
    }
  }
  

  async actualizarProducto(req, res) {
    const userId = req.userId;
    const { nombreProducto, unidad, cantidad } = req.body;

    try {
      validarValores({ unidad, cantidad });

      const productoRef = db
        .collection("usuarios")
        .doc(String(userId))
        .collection("stock")
        .doc(nombreProducto);
      await productoRef.update({
        cantidad,
        unidad,
        timestamp: new Date().toISOString(),
      });

      console.log(
        `Producto ${nombreProducto} actualizado en el stock del usuario ${userId}.`
      );
      res.status(200).json({
        message: `Producto ${nombreProducto} actualizado en el stock.`,
      });
    } catch (e) {
      console.error("Error al actualizar el producto en el stock: ", e.message);
      res.status(400).json({ error: e.message });
    }
  }

  async eliminarProducto(req, res) {
    const userId = req.userId;
    const { nombreProducto } = req.body;

    try {
      const productoRef = db
        .collection("usuarios")
        .doc(String(userId)) // Convert userId to string
        .collection("stock")
        .doc(nombreProducto);
      await productoRef.delete();

      console.log(
        `Producto ${nombreProducto} eliminado del stock del usuario ${userId}.`
      );
      res
        .status(200)
        .json({ message: `Producto ${nombreProducto} eliminado del stock.` });
    } catch (e) {
      console.error("Error al eliminar el producto del stock: ", e.message);
      res.status(500).json({ error: e.message });
    }
  }

    async consumirProductos(receta) {
      const userId = receta.userId;
      let productosNoConsumidos = [];
      let productosAConsumir = []
      try {
        for (const ingrediente of receta.ingredients) {
          let { description: nombreProducto, quantity: cantidad, unit: unidad } = ingrediente;
          cantidad = parseInt(cantidad)

          // Validar la cantidad
          validarProductoParaConsumo({ cantidad });

          // Buscar el producto en el stock del usuario
          const productoRef = db
            .collection("usuarios")
            .doc(String(userId))
            .collection("stock")
            .doc(nombreProducto);

          const docSnap = await productoRef.get();

          if (!docSnap.exists) {
            console.log(`${nombreProducto} no se encuentra en el stock`)
            productosNoConsumidos.push({ nombre: nombreProducto, cantidad, unidadMedida: unidad });
          continue;
          }

          const productoExistente = docSnap.data();

          // Verificar si la cantidad solicitada es menor o igual a la cantidad en stock
          if (cantidad > productoExistente.cantidad) {
            console.log
              (`Cantidad solicitada de ${nombreProducto} (${cantidad}) es mayor que la cantidad en stock (${productoExistente.cantidad}.`)
                    productosNoConsumidos.push({ nombre: nombreProducto, cantidad, unidadMedida: unidad });
          continue;

          }

          // Verificar que el nombre del producto coincida con un documento en la colección productos
          const productoDoc = await db
            .collection("productos")
            .doc(nombreProducto)
            .get();
          if (!productoDoc.exists) {
            console.log(`${nombreProducto} no se encuentra en la coleccion de productos`)
            productosNoConsumidos.push({ nombre: nombreProducto, cantidad, unidadMedida: unidad });
          continue;
          
          }
          else {
            productosAConsumir.push({
              nombre: nombreProducto,
              cantidad,
              unidadMedida: unidad,
            });
          }
        }
        console.log("productos a consumir");
        console.log(productosAConsumir);
        // Si todas las validaciones pasan, realizar la resta de los productos
        for (const ingrediente of productosAConsumir) {
          let { nombre: nombreProducto, cantidad } = ingrediente;
          cantidad = parseInt(cantidad);

          console.log(
            `Consumiendo ${ingrediente.quantity} ${ingrediente.unit} de ${ingrediente.description}`
          );

          const productoRef = db
            .collection("usuarios")
            .doc(String(userId))
            .collection("stock")
            .doc(nombreProducto);

          const docSnap = await productoRef.get();
          const productoExistente = docSnap.data();
          const nuevaCantidad = productoExistente.cantidad - cantidad;
          console.log(productoExistente);
          console.log(cantidad);
          console.log(nuevaCantidad);
          if (nuevaCantidad <= 0) {
            await productoRef.delete();
            console.log(
              `Producto ${nombreProducto} agotado. Eliminado del stock del usuario ${userId}.`
            );
          } else {
            await productoRef.update({
              cantidad: nuevaCantidad,
              ultimoConsumo: new Date().toISOString(),
            });
            console.log(
              `Producto ${nombreProducto} consumido correctamente. Actualizado en el stock del usuario ${userId}.`
            );
          }
        }

        if (productosNoConsumidos.length > 0) {
          console.log('Productos no consumidos:', productosNoConsumidos);
        }

        console.log(`Productos consumidos del stock del usuario ${userId}.`);
      } catch (e) {
        console.error("Error al consumir productos del stock: ", e.message);
        throw new Error(e.message);
      }
    }
  };

export default new StockController();

const validarValor = (variable) => {
  try {
    variable = parseInt(variable)
  } catch {
    throw new Error(
      "La cantidad del producto no se pudo parsear a entero."
    );
  }
  if (variable <= 0) {
    throw new Error(
      "La cantidad del producto debe ser un número entero positivo."
    );
  }
};

const validarProductoParaConsumo = (producto) => {
  if (!Number.isInteger(producto.cantidad) || producto.cantidad <= 0) {
    throw new Error(
      "La cantidad del producto debe ser un número entero positivo."
    );
  }
};

const formatText = (text) => {
  return (
    text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
  );
};