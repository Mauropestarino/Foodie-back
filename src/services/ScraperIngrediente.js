import puppeteer from 'puppeteer';
import admin from 'firebase-admin';
import serviceAccount from '../../firebaseServiceAccountKey.json' assert { type: "json" };
import { GoogleGenerativeAI } from "@google/generative-ai";
import config from "../config/config.js";

// Inicializar Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

//const model = await createModel();
const genAI = new GoogleGenerativeAI(config.generativeAIKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function determinarUnidad(item) {
  console.log(`Ingresando al método determinarUnidad para el producto: ${item}`);

  const prompt = `Dime si la unidad de medida para el producto "${item}" debe ser "gramos", "unidades" o "mililitros". Responde solo con "gramos" o "mililitros".`;

  let unidad = 'unidad'; // Valor predeterminado si la API no proporciona una respuesta válida
  let attempts = 0;

  while (unidad === 'unidad' && attempts < 5) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = await response.text();
      const posibleUnidad = text.trim().toLowerCase();

      if (posibleUnidad === 'gramos' || posibleUnidad === 'mililitros' || posibleUnidad === 'unidades') {
        unidad = posibleUnidad;
      } else {
        console.log(`Respuesta inválida recibida: ${posibleUnidad}. Reintentando...`);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 5000)); // Espera 5 segundos antes de reintentar en caso de respuesta inválida
      }
    } catch (error) {
      if (error.status === 429) {
        console.error(`Límite de cuota excedido para el producto "${item}". Esperando 60 segundos...`);
        await new Promise(resolve => setTimeout(resolve, 60000)); // Espera 60 segundos antes de reintentar
      } else {
        console.error(`Error al consultar la API de Gemini para el producto "${item}":`, error);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 5000)); // Espera 5 segundos antes de reintentar en caso de otros errores
      }
    }
  }
  
  if (attempts >= 5) {
    console.log(`No se pudo determinar la unidad de medida para el producto "${item}" después de 5 intentos.`);
    return null; // Indica que no se pudo determinar la unidad
  }

  return unidad;
}

async function obtenerItems(page) {
  return await page.evaluate(async () => {

    function formatText(text) {
      return (
        text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
      );
    };

    const texts = [];
    const filterContents = document.querySelectorAll('.valtech-carrefourar-search-result-0-x-filterContent');
    const lastFilterContent = filterContents[filterContents.length - 1];

    if (lastFilterContent) {
      let seeMoreButton = lastFilterContent.querySelector('.valtech-carrefourar-search-result-0-x-seeMoreButton');
      let filterItems = lastFilterContent.querySelectorAll('.valtech-carrefourar-search-result-0-x-filterItem label');

      while (seeMoreButton && filterItems.length <= 20) {
        seeMoreButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        filterItems = lastFilterContent.querySelectorAll('.valtech-carrefourar-search-result-0-x-filterItem label');
        seeMoreButton = lastFilterContent.querySelector('.valtech-carrefourar-search-result-0-x-seeMoreButton');
      }

      filterItems.forEach((label) => {
        const formattedText = formatText(label.textContent.trim());
        texts.push(formattedText);
      });
    }
    return texts;
  });
}

async function actualizarProducto(item) {
  try {
    const docRef = db.collection('productos').doc(item);
    const doc = await docRef.get();    
    if (doc.exists) {
      console.log(`Producto ya existe, no se actualiza: ${item}`);
    } else {
      const unidad = await determinarUnidad(item);
      await docRef.set({
        unidadMedida: unidad,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`-----Producto ${item} creado-----.`);
    }
  } catch (error) {
    console.error(`Error al actualizar el producto "${item}":`, error);
  }
  await new Promise(resolve => setTimeout(resolve, 200)); // Añadir un retraso de 200 ms entre cada solicitud
}

async function scrapearTipoDeProducto(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
    const items = await obtenerItems(page);

    console.log('-----------Tipos de productos en ', url, ':-----------');
    items.forEach((item) => console.log(item));

    for (const item of items) {     
      await actualizarProducto(item);    
    }
  } catch (error) {
    console.error('Error al scrapear en ', url, ':', error);
  } finally {
    await browser.close();
    console.log(`Finalizado el procesamiento de la URL: ${url}`);
  }
}

async function obtenerProductosPorUnidadMedida() {
  try {
    console.log('entre');
    const snapshot = await db.collection('productos').where('unidadMedida', '==', 'unidades').get();
    const productos = [];
    snapshot.forEach(doc => {
      productos.push({ id: doc.id, data: doc.data() });
    });
    return productos;
  } catch (error) {
    console.error('Error al obtener productos por unidad de medida:', error);
    return [];
  }
}

const urls = [
  'https://www.carrefour.com.ar/almacen',
  'https://www.carrefour.com.ar/Desayuno-y-merienda',
  'https://www.carrefour.com.ar/Lacteos-y-productos-frescos',
  'https://www.carrefour.com.ar/Carnes-y-Pescados',
  'https://www.carrefour.com.ar/Frutas-y-Verduras',
  'https://www.carrefour.com.ar/Bebidas',
  'https://www.carrefour.com.ar/Panaderia',
  'https://www.carrefour.com.ar/Congelados',
];

(async () => {
  
  const initialSnapshot = await db.collection('productos').get();
  const initialProductCount = initialSnapshot.size;
 
  await Promise.all(urls.map(url => scrapearTipoDeProducto(url)));

  const finalSnapshot = await db.collection('productos').get();
  const finalProductCount = finalSnapshot.size;
  const productsAdded = finalProductCount - initialProductCount;

  const productos = await obtenerProductosPorUnidadMedida();
  console.log(productos);

  console.log(`Productos iniciales: ${initialProductCount}`);
  console.log(`Productos agregados: ${productsAdded}`);
  console.log(`Productos totales ahora: ${finalProductCount}`);
})();
