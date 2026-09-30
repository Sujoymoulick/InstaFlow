/* eslint-disable no-param-reassign */
import { RANDOMIZE } from '../app/constants.js';
import type { Products } from '../types/entities.js';

import productsStaticJSON from '../../data/products.json' assert { type: 'json' };

const productsStaticData: Products = productsStaticJSON;

export function getProducts(randomize = RANDOMIZE) {
	console.log('getProducts');

	const result = productsStaticData;

	return result;
}
