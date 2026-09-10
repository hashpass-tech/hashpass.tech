/* Minimal checked-in bootstrap; `convex dev` replaces this with deployment-specific generated types. */
import { queryGeneric, mutationGeneric, actionGeneric } from 'convex/server';
export const query = queryGeneric;
export const mutation = mutationGeneric;
export const action = actionGeneric;
