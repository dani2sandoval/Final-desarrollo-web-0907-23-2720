const express = require("express");
const cors = require("cors");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { Sequelize, DataTypes, Op } = require("sequelize");

const app = express();
const PORT = 3000;

// Base de datos SQLite
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "./database.sqlite",
  logging: false,
});

// Modelos
const Usuario = sequelize.define(
  "Usuario",
  {
    usuario: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    contrasena: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  { timestamps: false }
);

const Sala = sequelize.define(
  "Sala",
  {
    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    capacidad: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  { timestamps: false }
);

const Reserva = sequelize.define(
  "Reserva",
  {
    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    horaInicio: {
      type: DataTypes.STRING(5),
      allowNull: false,
    },
    horaFin: {
      type: DataTypes.STRING(5),
      allowNull: false,
    },
  },
  { timestamps: false }
);

// Relaciones
Usuario.hasMany(Reserva);
Reserva.belongsTo(Usuario);

Sala.hasMany(Reserva);
Reserva.belongsTo(Sala);

// Configuración
app.use(express.json());

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(
  session({
    secret: "clave-secreta-biblioteca",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      maxAge: 30 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    },
  })
);

// Middleware para proteger rutas
function verificarSesion(req, res, next) {
  if (!req.session.usuarioId) {
    return res.status(401).json({ mensaje: "Sesión no válida o expirada" });
  }

  next();
}

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { usuario, contrasena } = req.body;

    if (!usuario || !contrasena) {
      return res.status(400).json({ mensaje: "Complete todos los campos" });
    }

    const usuarioEncontrado = await Usuario.findOne({
      where: { usuario },
    });

    if (!usuarioEncontrado) {
      return res.status(401).json({ mensaje: "Credenciales incorrectas" });
    }

    const contrasenaCorrecta = await bcrypt.compare(
      contrasena,
      usuarioEncontrado.contrasena
    );

    if (!contrasenaCorrecta) {
      return res.status(401).json({ mensaje: "Credenciales incorrectas" });
    }

    req.session.usuarioId = usuarioEncontrado.id;
    req.session.usuario = usuarioEncontrado.usuario;

    res.json({
      mensaje: "Inicio de sesión correcto",
      usuario: usuarioEncontrado.usuario,
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al iniciar sesión" });
  }
});

// Verificar sesión
app.get("/api/sesion", verificarSesion, (req, res) => {
  res.json({
    usuario: req.session.usuario,
  });
});

// Cerrar sesión
app.post("/api/logout", verificarSesion, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ mensaje: "Sesión cerrada" });
  });
});

// Listar salas
app.get("/api/salas", verificarSesion, async (req, res) => {
  try {
    const salas = await Sala.findAll();
    res.json(salas);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener las salas" });
  }
});

// Listar reservas
app.get("/api/reservas", verificarSesion, async (req, res) => {
  try {
    const reservas = await Reserva.findAll({
      include: [
        {
          model: Sala,
          attributes: ["nombre"],
        },
      ],
      order: [
        ["fecha", "ASC"],
        ["horaInicio", "ASC"],
      ],
    });

    res.json(reservas);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener las reservas" });
  }
});

// Crear reserva
app.post("/api/reservas", verificarSesion, async (req, res) => {
  try {
    const { salaId, fecha, horaInicio, horaFin } = req.body;

    if (!salaId || !fecha || !horaInicio || !horaFin) {
      return res.status(400).json({ mensaje: "Complete todos los campos" });
    }

    if (horaInicio >= horaFin) {
      return res.status(400).json({
        mensaje: "La hora final debe ser mayor que la hora inicial",
      });
    }

    const sala = await Sala.findByPk(salaId);

    if (!sala) {
      return res.status(404).json({ mensaje: "La sala no existe" });
    }

    // Busca reservas que se solapen con el nuevo horario
    const reservaSolapada = await Reserva.findOne({
      where: {
        SalaId: salaId,
        fecha,
        [Op.and]: [
          { horaInicio: { [Op.lt]: horaFin } },
          { horaFin: { [Op.gt]: horaInicio } },
        ],
      },
    });

    if (reservaSolapada) {
      return res.status(409).json({
        mensaje: "La sala ya está reservada en ese horario",
      });
    }

    const nuevaReserva = await Reserva.create({
      SalaId: salaId,
      UsuarioId: req.session.usuarioId,
      fecha,
      horaInicio,
      horaFin,
    });

    res.status(201).json({
      mensaje: "Reserva creada correctamente",
      reserva: nuevaReserva,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al crear la reserva" });
  }
});

// Crear tablas y datos iniciales
async function iniciarServidor() {
  try {
    await sequelize.sync();

    if ((await Usuario.count()) === 0) {
      const contrasenaCifrada = await bcrypt.hash("1234", 10);

      await Usuario.create({
        usuario: "admin",
        contrasena: contrasenaCifrada,
      });
    }

    if ((await Sala.count()) === 0) {
      await Sala.bulkCreate([
        { nombre: "Sala 1", capacidad: 4 },
        { nombre: "Sala 2", capacidad: 6 },
        { nombre: "Sala 3", capacidad: 10 },
      ]);
    }

    app.listen(PORT, () => {
      console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
      console.log("Usuario: admin | Contraseña: 1234");
    });
  } catch (error) {
    console.error("No se pudo iniciar el servidor:", error);
  }
}

iniciarServidor();