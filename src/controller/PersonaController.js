import { db } from "../connection/firebaseConnection.js";
import { v4 as uuidv4 } from "uuid";

const RestriccionesEnum = {
  CELIACO: "Celiaquía",
  EMBARAZADA: "Embarazo",
  VEGETARIANO: "Vegetarianismo",
  VEGANO: "Veganismo",
  DIABETES: "Diabetes",
  KOSHER: "Kosher",
  HIPERTENSION: "Hipertensión",
  INTOLERANTE_LACTOSA: "Intolerancia a la lactosa",
  NINGUNA: "Ninguna"
};

const validarPersona = (persona) => {
  if (typeof persona.nombre !== "string" || persona.nombre.trim() === "") {
    throw new Error("El nombre es obligatorio y debe ser una cadena no vacía.");
  }
  if (typeof persona.apellido !== "string" || persona.apellido.trim() === "") {
    throw new Error(
      "El apellido es obligatorio y debe ser una cadena no vacía."
    );
  }
  if (!Number.isInteger(persona.edad) || persona.edad <= 0) {
    throw new Error("La edad debe ser un número entero positivo.");
  }
  if (!Array.isArray(persona.restricciones)) {
    throw new Error("Las restricciones deben ser un array.");
  }
  persona.restricciones.forEach((restriccion) => {
    if (!Object.values(RestriccionesEnum).includes(restriccion)) {
      throw new Error(`Restricción no válida: ${restriccion}`);
    }
  });
};

const generarIdPersona = (nombre, apellido) => {
  return `${nombre.trim().toLowerCase()}_${apellido
    .trim()
    .toLowerCase()}_${uuidv4()}`;
};

class PersonaController {
  async crearPersona(personaUser) {
    const persona = personaUser;
    try {
      console.log("Datos recibidos para crear persona:", persona);
      validarPersona(persona);
      persona.personaId = generarIdPersona(persona.nombre, persona.apellido);

      if (
        !persona.personaId ||
        typeof persona.personaId !== "string" ||
        persona.personaId.trim() === ""
      ) {
        throw new Error("ID de persona inválido.");
      }

      const docRef = db.collection("personas").doc(persona.personaId);
      await docRef.set(persona);
      console.log("Documento escrito con ID: ", persona.personaId);
      return { status: 201, id: persona.personaId, ...persona };
    } catch (e) {
      console.error("Error al agregar el documento: ", e.message);
      return {
        status: 400,
        error: `Error al agregar el documento: ${e.message}`,
      };
    }
  }

  async obtenerPersona(req, res) {
    const { id } = req.params;

    try {
      const docRef = db.collection("personas").doc(id);
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        res.status(200).json(docSnap.data());
      } else {
        console.log("No se encontró el documento!");
        res.status(404).json({ error: "Persona no encontrada" });
      }
    } catch (e) {
      console.error("Error al obtener el documento: ", e.message);
      res.status(500).json({ error: e.message });
    }
  }

  async obtenerPersonas(req, res) {
    try {
      const querySnapshot = await db.collection("personas").get();
      const personas = [];
      querySnapshot.forEach((doc) => {
        personas.push({ id: doc.id, ...doc.data() });
      });
      res.status(200).json(personas);
    } catch (e) {
      console.error("Error al obtener los documentos: ", e.message);
      res.status(500).json({ error: e.message });
    }
  }

  actualizarPersona = async (persona) => {
    const { id } = persona;

    try {
      validarPersona(persona);

      const docRef = db.collection("personas").doc(id);
      await docRef.update(persona);

      console.log("Persona actualizada con éxito");

      return { status: 200, data: persona };
    } catch (e) {
      console.error("Error al actualizar la persona: ", e.message);
      return { status: 400, error: e.message };
    }
  };

  async eliminarPersona(req, res) {
    const { id } = req.params;

    try {
      const docRef = db.collection("personas").doc(id);
      await docRef.delete();
      console.log("Persona eliminada con éxito");
      res.status(200).json({ message: "Persona eliminada con éxito" });
    } catch (e) {
      console.error("Error al eliminar la persona: ", e.message);
      res.status(500).json({ error: e.message });
    }
  }
}

export default new PersonaController();
