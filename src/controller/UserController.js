import { db } from "../connection/firebaseConnection.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import config from "../config/config.js";
import PersonaController from "./PersonaController.js";

const saltRounds = 10;

class UserController {
  async crearUsuario(req, res) {
    try {
      if (!req.body) {
        throw new Error("No se recibieron datos en la solicitud.");
      }
      console.log(req.body);

     const {
       mail,
       password,
       persona: { nombre, apellido, edad, restricciones = [] } = {}, // Destructure persona from request body
     } = req.body;

      console.log("Datos recibidos para crear usuario:", {
        mail,
        password,
        nombre,
        apellido,
        edad,
        restricciones,
      });

      await validarUsuario({ mail, password });
      const personaUser = { nombre, apellido, edad, restricciones };

      // Additional logging before creating persona
      console.log("Datos enviados para crear persona:", personaUser);

      const persona = await PersonaController.crearPersona(personaUser);
      if (persona.error) {
        throw new Error(persona.error);
      }

      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const nuevoUsuario = {
        mail,
        password: hashedPassword,
        persona,
      };

      const userRef = db.collection("usuarios").doc(mail.trim());
      await userRef.set(nuevoUsuario);

      console.log("Usuario creado con ID: ", mail);
      res.status(201).json({ id: mail, ...nuevoUsuario });
    } catch (e) {
      console.error("Error al crear el usuario: ", e.message);
      res.status(400).json({ error: e.message });
    }
  }

  // Autenticar usuario y generar token
  async autenticarUsuario(req, res) {
    const { mail, password } = req.body;

    try {
      const userRef = db.collection("usuarios").doc(mail);
      const docSnap = await userRef.get();

      if (!docSnap.exists) {
        return res.status(404).json({ error: "Usuario no encontrado." });
      }

      const user = docSnap.data();
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({ error: "Contraseña incorrecta." });
      }

      // Crear un token con el ID del usuario y una fecha de expiración
      const token = jwt.sign({ id: user.mail }, config.secretKey, {
        expiresIn: "2h", // El token expira en 3 horas
      });

      res.status(200).json({ auth: true, token });
    } catch (e) {
      console.error("Error al autenticar el usuario: ", e.message);
      res.status(500).json({ error: e.message });
    }
  }

  // Obtener un usuario por ID
  async obtenerUsuario(req, res) {
    const userId = req.user.id;
    console.log(userId);
    try {
      const userRef = db.collection("usuarios").doc(userId);
      const docSnap = await userRef.get();

      if (docSnap.exists) {
        const comensalesSnap = await userRef.collection("grupoFamiliar").get();
        const historialSnap = await userRef.collection("historial").get();
        const creadasSnap = await userRef.collection("creadas").get();
        const favoritasSnap = await userRef.collection("favoritas").get();
        const stockSnap = await userRef.collection("stock").get();

        const comensales = comensalesSnap.docs.map((doc) => doc.data());
        const historial = historialSnap.docs.map((doc) => doc.data());
        const creadas = creadasSnap.docs.map((doc) => doc.data());
        const favoritas = favoritasSnap.docs.map((doc) => doc.data());
        const stock = stockSnap.docs.map((doc) => doc.data());

        res.status(200).json({ ...docSnap.data(), comensales, historial, creadas, favoritas, stock });
      } else {
        console.log("No se encontró el documento!");
        res.status(404).json({ error: "Usuario no encontrado" });
      }
    } catch (e) {
      console.error("Error al obtener el usuario: ", e.message);
      res.status(500).json({ error: e.message });
    }
  }

  // Obtener todos los usuarios
  async obtenerUsuarios(req, res) {
    try {
      const querySnapshot = await db.collection("usuarios").get();
      const usuarios = [];
      for (const doc of querySnapshot.docs) {
        const userData = doc.data();
        const userRef = db.collection("usuarios").doc(doc.id);

        const comensalesSnap = await userRef.collection("grupoFamiliar").get();
        const historialSnap = await userRef.collection("historial").get();
        const creadasSnap = await userRef.collection("creadas").get();
        const favoritasSnap = await userRef.collection("favoritas").get();
        const stockSnap = await userRef.collection("stock").get();

        const comensales = comensalesSnap.docs.map((doc) => doc.data());
        const historial = historialSnap.docs.map((doc) => doc.data());
        const creadas = creadasSnap.docs.map((doc) => doc.data());
        const favoritas = favoritasSnap.docs.map((doc) => doc.data());
        const stock = stockSnap.docs.map((doc) => doc.data());

        usuarios.push({ ...userData, comensales, historial, creadas, favoritas, stock });
      }
      res.status(200).json(usuarios);
    } catch (e) {
      console.error("Error al obtener los usuarios: ", e.message);
      res.status(500).json({ error: e.message });
    }
  }

  // Autenticar usuario y generar token
  async login(req, res) {
    const { email, password } = req.body;

    try {
      const userRef = db.collection("usuarios").doc(email);
      const docSnap = await userRef.get();

      if (!docSnap.exists) {
        return res.status(404).json({ error: "Usuario no encontrado." });
      }

      const user = docSnap.data();
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({ error: "Contraseña incorrecta." });
      }

      // Crear un token con el ID del usuario y una fecha de expiración
      const token = jwt.sign({ id: user.mail }, config.secretKey, {
        expiresIn: "2h", // El token expira en 2 horas
      });

      const recetaTemporal = user.recetaTemporal || null;

      console.log(`Logueado exitosamente con el mail: ${email}`)

      res.status(200).json({ auth: true, token, recetaTemporal });
    } catch (e) {
      console.error("Error al autenticar el usuario: ", e.message);
      res.status(500).json({ error: e.message });
    }
  }

  // Actualizar un usuario
  async actualizarRestriccionesUsuario(req, res) {
    const userId = req.user.id;
    const { restricciones } = req.body;

    try {
      if (!restricciones) {
        return res.status(400).json({ error: "No se proporcionaron restricciones para actualizar" });
      }

      const userRef = db.collection("usuarios").doc(userId);
      const docSnap = await userRef.get();

      if (!docSnap.exists) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      const userData = docSnap.data();
      console.log(userData)
      // Actualiza restricciones dentro de persona en el documento del usuario
      userData.persona.restricciones = restricciones;

      // También actualiza la persona en la colección personas
      const result = await PersonaController.actualizarPersona(userData.persona);

      if (result.status !== 200) {
        throw new Error(result.error);
      }

      await userRef.update(userData);
      console.log("Usuario actualizado con éxito");
      res.status(200).json({ id: userId, restricciones: userData.persona.restricciones });
    } catch (e) {
      console.error("Error al actualizar el usuario: ", e.message);
      res.status(400).json({ error: e.message });
    }
  }

  // Eliminar un usuario
  async eliminarUsuario(req, res) {
    const userId = req.userId;

    try {
      const userRef = db.collection("usuarios").doc(userId);

        // Eliminar documentos de la subcolección comensales
        let snapshot = await userRef.collection("grupoFamiliar").get();
        for (const doc of snapshot.docs) {
          await doc.ref.delete();
        }
 
        // Eliminar documentos de la subcolección recetas
        snapshot = await userRef.collection("historial").get();
        for (const doc of snapshot.docs) {
          await doc.ref.delete();
        }

        // Eliminar documentos de la subcolección creadas
        snapshot = await userRef.collection("creadas").get();
        for (const doc of snapshot.docs) {
          await doc.ref.delete();
        }

        // Eliminar documentos de la subcolección favoritas
        snapshot = await userRef.collection("favoritas").get();
        for (const doc of snapshot.docs) {
          await doc.ref.delete();
        }  
 
        // Eliminar documentos de la subcolección stock
        snapshot = await userRef.collection("stock").get();
        for (const doc of snapshot.docs) {
          await doc.ref.delete();
        }

          // Eliminar el documento del usuario
          await userRef.delete();

          console.log("Usuario eliminado con éxito");
          res.status(200).json({ message: "Usuario eliminado con éxito" });
    } catch (e) {
          console.error("Error al eliminar el usuario: ", e.message);
          res.status(500).json({ error: e.message });
    }
  }
}

export default new UserController();

const validarUsuario = async (usuario) => {  
  await validarEmail(usuario.mail);
  await validarPassword(usuario.password);
};

const validarEmail = async (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email)) {
    throw new Error("El correo electrónico no es válido.");
  }
  if (typeof email !== "string" || email.trim() === "") {
    throw new Error(
      "El correo electrónico es obligatorio y debe ser una cadena no vacía."
    );
  }
  // Validar si el correo ya está en uso
  const userRef = db.collection("usuarios").doc(email);
  const docSnap = await userRef.get();
  if (docSnap.exists) {
    throw new Error(
      "El correo electrónico ya está en uso."
    );
  };
}

const validarPassword = (password) => {
  if (typeof password !== "string" || password.trim() === "") {
    throw new Error(
      "La contraseña es obligatoria y debe ser una cadena no vacía."
    );
  }
}