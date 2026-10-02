// Ephemeral read projection; no body cache and no ID allocation.
export function* readBody(state) {
  for (const { id, text, ink } of state.material.body) yield Object.freeze({ id, text, ink });
}
