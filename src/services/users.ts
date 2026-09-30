/* eslint-disable no-param-reassign */
import { RANDOMIZE } from '../app/constants.js';
import type { Users } from '../types/entities.js';

import usersStaticJSON from '../../data/users.json' assert { type: 'json' };

const usersStaticData: Users = usersStaticJSON;

export function getUsers(randomize = RANDOMIZE) {
	console.log('getUsers');

	const result = usersStaticData;

	return result;
}
