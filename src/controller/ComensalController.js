import { db } from "../connection/firebaseConnection.js";
import PersonaController from "./PersonaController.js";

class ComensalController {
  // Método para agregar un comensal a la colección grupoFamiliar de un usuario
  agregarComensal = async (req, res) => {
    const userId = req.user.id;
    console.log(userId);
    if (!userId) {
      console.error("userId is null or undefined");
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const { nombre, apellido, edad, restricciones } = req.body;

    try {
      const personaReq = { nombre, apellido, edad, restricciones };
      const personaResult = await PersonaController.crearPersona(personaReq);
      console.log(personaResult);
      if (personaResult.status !== 201) {
        return res.status(personaResult.status).json({ error: personaResult.error });
      }

      const persona = personaResult;
      // Agregar persona a la colección grupoFamiliar del usuario
      const comensalesRef = db
        .collection("usuarios")
        .doc(userId)
        .collection("grupoFamiliar")
        .doc(persona.id);

      await comensalesRef.set({...persona, creacion: new Date().toISOString()});

      const docRef = db.collection("personas").doc(persona.personaId);
      await docRef.set(persona);

      console.log(`Persona ${persona.id} agregada al grupo de comensales del usuario ${userId}.`);
      return res.status(201).json({ message: "Persona agregada al grupo de comensales.", persona });
    } catch (e) {
      console.error("Error al agregar la persona al grupo de comensales: ", e.message);
      return res.status(400).json({ error: e.message });
    }
  };

  async actualizarComensal(req, res) {
    const userId = req.user.id;
    console.log(userId);
    const { nombre, apellido, edad, restricciones } = req.body;
    console.log(req.body);

    try {
      // Obtener el personaId basado en los detalles del usuario
      const comensalesSnapshot = await db
        .collection("usuarios")
        .doc(userId)
        .collection("grupoFamiliar")
        .where("nombre", "==", nombre)
        .where("apellido", "==", apellido)
        .get();

      if (comensalesSnapshot.empty) {
        return res.status(404).json({error: "Persona no encontrada en el grupo familiar del usuario.",});
      }

      const personaDoc = comensalesSnapshot.docs[0];

      const personaId = personaDoc.id;
      console.log(personaId);

      const persona = {
        id: personaId,
        nombre,
        apellido,
        edad,
        restricciones: restricciones || [],
      };

      // Lógica de validar y actualizar persona y guardarla en la colección 'personas'
      const updateResult = await PersonaController.actualizarPersona(persona);

      if (updateResult.status !== 200) {
        return res.status(updateResult.status).json({ error: updateResult.error });
      }

      const comensalRef = db
        .collection("usuarios")
        .doc(userId)
        .collection("grupoFamiliar")
        .doc(personaId);

      await comensalRef.update({...persona, timestamp: new Date().toISOString(),});

      console.log(`Persona ${personaId} actualizada en el grupo de comensales del usuario ${userId} y en la colección personas.`);
      res.status(200).json({message:"Persona actualizada en el grupo de comensales y en la colección personas.",});
    } catch (e) {
      console.error("Error al actualizar la persona en el grupo de comensales: ", e.message);
      res.status(400).json({ error: e.message });
    }
  }

  eliminarComensal = async (req, res) => {
    const userId = req.user.id;
    const { nombre, apellido } = req.query;

    if (!userId) {
      console.error("userId is null or undefined");
      return res.status(400).json({ error: "Invalid user ID" });
    }

    if (!nombre || !apellido) {
      console.error("nombre or apellido is null or undefined");
      return res.status(400).json({ error: "Invalid name or surname" });
    }

    try {
      const comensalesSnapshot = await db
        .collection("usuarios")
        .doc(userId)
        .collection("grupoFamiliar")
        .where("nombre", "==", nombre)
        .where("apellido", "==", apellido)
        .get();

      if (comensalesSnapshot.empty) {
        return res.status(404).json({ error: "Persona not found in the user's group." });
      }

      const personaDoc = comensalesSnapshot.docs[0];
      await personaDoc.ref.delete();

      console.log(`Persona ${personaDoc.id} eliminada del grupo de comensales del usuario ${userId}.`);
      res.status(200).json({ message: "Persona eliminada del grupo de comensales." });
    } catch (e) {
      console.error("Error al eliminar la persona del grupo de comensales: ", e.message);
      res.status(500).json({ error: e.message });
    }
  };

  obtenerComensales = async (req, res) => {
    const userId = req.user.id;

    if (!userId) {
      console.error("userId is null or undefined");
      return res.status(400).json({ error: "Invalid user ID" });
    }

    try {
      const comensalesSnapshot = await db
        .collection("usuarios")
        .doc(userId)
        .collection("grupoFamiliar")
        .get();

      if (comensalesSnapshot.empty) {
        return res.status(200).json([]);
      }

      const comensales = comensalesSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          restricciones: Array.isArray(data.restricciones) ? data.restricciones : [],
        };
      });

      res.status(200).json(comensales);
    } catch (e) {
      console.error("Error al obtener el grupo de comensales: ", e.message);
      res.status(500).json({ error: e.message });
    }
  };
}

export default new ComensalController();
