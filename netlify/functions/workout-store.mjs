import { getUser } from '@netlify/identity';
import { createHandler } from '../lib/sheets-store.mjs';
export default createHandler({ getUser });
