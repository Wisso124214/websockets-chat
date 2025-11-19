# WebSockets Chat (Deno + Web Components)

Proyecto de chat en tiempo real usando WebSockets, Deno en el backend y Web Components (sin framework) en el frontend.

## Características Principales

- Gestión de alias de clientes y grupos con CRUD básico (crear / actualizar miembros / eliminar).
- Mensajería directa y grupal (texto y archivos binarios).
- Persistencia offline de mensajes vía IndexedDB por sesión y chat.
- UI desacoplada en componentes (`wsc-chat`, `wsc-chat-list`, `wsc-message`, etc.).
- Sanitización en servidor para evitar exponer emails, posibles tokens, números largos sensibles.

## Estructura Relevante

```text
client.js                # Lógica principal cliente WebSocket
app_server.js            # Servidor WebSocket Deno + static serve mínimo
components/              # Web Components reutilizables
screens/                 # Pantallas principales (main / chat)
components/db/indexedDB.js # Helper IndexedDB mensajes
```

## Ejecución del Servidor

El servidor usa Deno. Instala Deno: <https://deno.com>

```bash
deno run --allow-net=0.0.0.0:8081 --allow-read server.js
```

Permisos sugeridos:

- `--allow-net=0.0.0.0:8081` para escuchar WebSocket.
- `--allow-read` para servir archivos estáticos.

### Nota sobre `package.json`

El `package.json` existe solo para metadatos y posible integración con herramientas Node (por ejemplo, abrir Live Server o manejar scripts auxiliares). El servidor principal corre en Deno, no en Node. Si deseas portar a Node deberías reemplazar `app_server.js` por un equivalente usando `ws` u otra librería.

## API de Mensajes (Cliente → Servidor)

| Tipo               | Payload                                      | Descripción                                  |
| ------------------ | -------------------------------------------- | -------------------------------------------- |
| `alias`            | `{ id, alias }`                              | Registra alias de cliente tras asignarse ID. |
| `message`          | `{ targetId, payload }`                      | Mensaje de texto a cliente o grupo.          |
| `attachment`       | `{ targetId, data:Array<number>, filename }` | Archivo binario.                             |
| `createGroup`      | `{ groupAlias }`                             | Crea nuevo grupo.                            |
| `addClientToGroup` | `{ groupId, targetId }`                      | Añade cliente a grupo.                       |
| `remClientToGroup` | `{ groupId, targetId }`                      | Elimina cliente del grupo.                   |
| `delGroup`         | `{ groupId }`                                | Elimina grupo (no el default).               |

## Eventos del Servidor (Server → Cliente)

| Tipo                 | Campos                                              | Descripción                     |
| -------------------- | --------------------------------------------------- | ------------------------------- |
| `id`                 | `{ id }`                                            | Asignación inicial de ID único. |
| `newClient`          | `{ id, alias }`                                     | Notificación de nuevo cliente.  |
| `clientsList`        | `{ clients:[{id,alias}] }`                          | Lista completa actual.          |
| `groupsList`         | `{ groups:[{id,alias,members[]}] }`                 | Lista de grupos.                |
| `groupCreated`       | `{ group }`                                         | Grupo creado.                   |
| `groupUpdated`       | `{ group }`                                         | Miembros/nombre actualizado.    |
| `groupDeleted`       | `{ groupId }`                                       | Grupo eliminado.                |
| `message`            | `{ id_from, id_target?, groupId?, from, payload }`  | Mensaje de texto.               |
| `attachment`         | `{ data, filename, id_from, id_target?, groupId? }` | Archivo.                        |
| `clientDisconnected` | `{ id, alias }`                                     | Cliente salió.                  |

## Persistencia IndexedDB

Store: `messages`

Campos clave:

- `sessionId`: ID de cliente (diferencia sesiones distintas).
- `chatId`: ID del destinatario (cliente o grupo).
- `direction`: 'in' | 'out'.
- `type`: 'text' | 'file'.
- Índices compuestos para consultas eficientes por sesión + chat.

## Desarrollo Frontend

Los componentes están diseñados para ser lo más independientes posible. Comunicación global mínima mediante:

- `window.websocket`
- `window.clientId` / `window.clientAlias`

## Próximas Mejores Prácticas Posibles

- Añadir reconexión automática con backoff exponencial.
- Visualización de progreso al subir archivos grandes.
- Cifrado end-to-end opcional (a nivel payload antes de enviar).
- Tests unitarios para sanitización y operaciones de grupo.

## Uso Rápido

1. Inicia servidor (ver comando arriba).
2. Abre `index.html` con Live Server o similar.
3. Ingresa alias cuando el modal lo solicite.
4. Envía mensajes y crea grupos con la API expuesta en `window.*` si necesitas pruebas rápidas.

---

Documentación ampliada para mejorar mantenibilidad y onboarding.
