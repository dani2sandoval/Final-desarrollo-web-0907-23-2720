import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:3000/api";

function App() {
  const [autenticado, setAutenticado] = useState(null);
  const [salas, setSalas] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [mensaje, setMensaje] = useState("");

  const [login, setLogin] = useState({
    usuario: "",
    contrasena: "",
  });

  const [formulario, setFormulario] = useState({
    salaId: "",
    fecha: "",
    horaInicio: "",
    horaFin: "",
  });

  async function peticion(ruta, opciones = {}) {
    const respuesta = await fetch(`${API}${ruta}`, {
      credentials: "include",
      ...opciones,
      headers: {
        "Content-Type": "application/json",
        ...opciones.headers,
      },
    });

    const datos = await respuesta.json().catch(() => ({}));

    if (respuesta.status === 401 && ruta !== "/login") {
      setAutenticado(false);
      throw new Error("La sesión expiró. Inicie sesión nuevamente.");
    }

    if (!respuesta.ok) {
      throw new Error(datos.mensaje || "Ocurrió un error");
    }

    return datos;
  }

  useEffect(() => {
    async function verificarSesion() {
      try {
        await peticion("/sesion");
        setAutenticado(true);
      } catch {
        setAutenticado(false);
      }
    }

    verificarSesion();
  }, []);

  useEffect(() => {
    if (autenticado) {
      cargarDatos();
    }
  }, [autenticado]);

  async function cargarDatos() {
    try {
      const [datosSalas, datosReservas] = await Promise.all([
        peticion("/salas"),
        peticion("/reservas"),
      ]);

      setSalas(datosSalas);
      setReservas(datosReservas);

      if (datosSalas.length > 0) {
        setFormulario((anterior) => ({
          ...anterior,
          salaId: anterior.salaId || String(datosSalas[0].id),
        }));
      }
    } catch (error) {
      setMensaje(error.message);
    }
  }

  async function iniciarSesion(evento) {
    evento.preventDefault();
    setMensaje("");

    try {
      const datos = await peticion("/login", {
        method: "POST",
        body: JSON.stringify(login),
      });

      setAutenticado(true);
      setMensaje(datos.mensaje);
    } catch (error) {
      setMensaje(error.message);
    }
  }

  async function crearReserva(evento) {
    evento.preventDefault();
    setMensaje("");

    try {
      const datos = await peticion("/reservas", {
        method: "POST",
        body: JSON.stringify({
          ...formulario,
          salaId: Number(formulario.salaId),
        }),
      });

      setMensaje(datos.mensaje);

      setFormulario((anterior) => ({
        ...anterior,
        fecha: "",
        horaInicio: "",
        horaFin: "",
      }));

      await cargarDatos();
    } catch (error) {
      setMensaje(error.message);
    }
  }

  async function cerrarSesion() {
    try {
      await peticion("/logout", {
        method: "POST",
      });
    } finally {
      setAutenticado(false);
      setReservas([]);
      setSalas([]);
      setMensaje("");
    }
  }

  if (autenticado === null) {
    return <p className="cargando">Cargando...</p>;
  }

  if (!autenticado) {
    return (
      <main className="login">
        <h1>Biblioteca</h1>
        <h2>Iniciar sesión</h2>

        <form onSubmit={iniciarSesion}>
          <label>Usuario</label>
          <input
            value={login.usuario}
            onChange={(e) =>
              setLogin({ ...login, usuario: e.target.value })
            }
            required
          />

          <label>Contraseña</label>
          <input
            type="password"
            value={login.contrasena}
            onChange={(e) =>
              setLogin({ ...login, contrasena: e.target.value })
            }
            required
          />

          <button type="submit">Ingresar</button>
        </form>

        {mensaje && <p className="mensaje">{mensaje}</p>}

        <small>Usuario: admin / Contraseña: 1234</small>
      </main>
    );
  }

  return (
    <main className="contenedor">
      <header>
        <h1>Reservas de salas</h1>
        <button onClick={cerrarSesion}>Cerrar sesión</button>
      </header>

      {mensaje && <p className="mensaje">{mensaje}</p>}

      <section>
        <h2>Salas disponibles</h2>

        <ul>
          {salas.map((sala) => (
            <li key={sala.id}>
              {sala.nombre} — Capacidad: {sala.capacidad}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Nueva reserva</h2>

        <form onSubmit={crearReserva}>
          <label>Sala</label>
          <select
            value={formulario.salaId}
            onChange={(e) =>
              setFormulario({ ...formulario, salaId: e.target.value })
            }
            required
          >
            {salas.map((sala) => (
              <option key={sala.id} value={sala.id}>
                {sala.nombre}
              </option>
            ))}
          </select>

          <label>Fecha</label>
          <input
            type="date"
            value={formulario.fecha}
            onChange={(e) =>
              setFormulario({ ...formulario, fecha: e.target.value })
            }
            required
          />

          <label>Hora de inicio</label>
          <input
            type="time"
            value={formulario.horaInicio}
            onChange={(e) =>
              setFormulario({
                ...formulario,
                horaInicio: e.target.value,
              })
            }
            required
          />

          <label>Hora de finalización</label>
          <input
            type="time"
            value={formulario.horaFin}
            onChange={(e) =>
              setFormulario({ ...formulario, horaFin: e.target.value })
            }
            required
          />

          <button type="submit">Reservar sala</button>
        </form>
      </section>

      <section>
        <h2>Reservas registradas</h2>

        {reservas.length === 0 ? (
          <p>No existen reservas.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Sala</th>
                <th>Fecha</th>
                <th>Inicio</th>
                <th>Hora final</th>
              </tr>
            </thead>

            <tbody>
              {reservas.map((reserva) => (
                <tr key={reserva.id}>
                  <td>{reserva.Sala?.nombre}</td>
                  <td>{reserva.fecha}</td>
                  <td>{reserva.horaInicio}</td>
                  <td>{reserva.horaFin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

export default App;