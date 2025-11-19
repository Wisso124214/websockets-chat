// Deno test for group CRUD and messaging
import { startServer } from './app_server.js';
import {
  assertEquals,
  assert,
} from 'https://deno.land/std@0.224.0/testing/asserts.ts';

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const connectClient = async () => {
  const ws = new WebSocket(`ws://localhost:8085/`);
  const state = { id: null, alias: null, messages: [], groupsEvents: [] };
  ws.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === 'id') state.id = data.id;
      if (data.type === 'message') state.messages.push(data);
      if (
        data.type === 'groupCreated' ||
        data.type === 'groupUpdated' ||
        data.type === 'groupDeleted'
      ) {
        state.groupsEvents.push(data);
      }
      if (data.type === 'groupsList') {
        state.groupsEvents.push({ type: 'groupsList', groups: data.groups });
      }
    } catch (_) {}
  };
  await new Promise((res) => (ws.onopen = res));
  await delay(20);
  return { ws, state };
};

Deno.test('groups CRUD and messaging', async () => {
  const server = startServer(8085);
  // connect two clients
  const c1 = await connectClient();
  const c2 = await connectClient();
  // wait ids
  await delay(50);
  assert(c1.state.id);
  assert(c2.state.id);
  // send aliases
  c1.ws.send(
    JSON.stringify({ type: 'alias', alias: 'Alice', id: c1.state.id })
  );
  c2.ws.send(JSON.stringify({ type: 'alias', alias: 'Bob', id: c2.state.id }));
  await delay(100);

  // create group from c1
  c1.ws.send(JSON.stringify({ type: 'createGroup', groupAlias: 'TestGroup' }));
  await delay(100);
  const createdEvent = c1.state.groupsEvents.find(
    (e) => e.type === 'groupCreated'
  );
  assert(createdEvent, 'groupCreated event missing');
  const groupId = createdEvent.group.id;
  assert(groupId.startsWith('group-'));
  assertEquals(createdEvent.group.members.length, 1);

  // add c2 to group
  c1.ws.send(
    JSON.stringify({ type: 'addClientToGroup', groupId, targetId: c2.state.id })
  );
  await delay(100);
  const updatedEvent = c1.state.groupsEvents
    .filter((e) => e.type === 'groupUpdated')
    .pop();
  assert(updatedEvent, 'groupUpdated missing after add');
  assertEquals(updatedEvent.group.members.includes('Alice'), true);
  assertEquals(updatedEvent.group.members.includes('Bob'), true);

  // send message to group
  c1.ws.send(
    JSON.stringify({
      type: 'message',
      payload: 'Hello Group',
      targetId: groupId,
    })
  );
  await delay(100);
  const c2Msg = c2.state.messages.find((m) => m.payload === 'Hello Group');
  assert(c2Msg, 'Group message not received by second member');

  // remove Bob from group
  c1.ws.send(
    JSON.stringify({ type: 'remClientToGroup', groupId, targetId: c2.state.id })
  );
  await delay(100);
  const updatedEvent2 = c1.state.groupsEvents
    .filter((e) => e.type === 'groupUpdated')
    .pop();
  assert(updatedEvent2, 'groupUpdated missing after removal');
  assertEquals(updatedEvent2.group.members.includes('Bob'), false);

  // delete group
  c1.ws.send(JSON.stringify({ type: 'delGroup', groupId }));
  await delay(100);
  const deletedEvent = c1.state.groupsEvents.find(
    (e) => e.type === 'groupDeleted'
  );
  assert(deletedEvent, 'groupDeleted event missing');
  assertEquals(deletedEvent.groupId, groupId);

  c1.ws.close();
  c2.ws.close();
  await delay(50);
  server.shutdown();
});
