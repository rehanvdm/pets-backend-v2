import { Pet } from '../models/pet';

const pets: Pet[] = [
  {
    id: 1,
    type: 'cat',
    name: 'Molly',
  },
  {
    id: 2,
    type: 'dog',
    name: 'Shadow',
  },
  {
    id: 3,
    type: 'dog',
    name: 'Ava',
  },
  {
    id: 4,
    type: 'cat',
    name: 'Toothless',
  },
  {
    id: 5,
    type: 'cat',
    name: 'Sunshine',
  },
];

export function getPets(): Pet[] {
  return pets;
}

export function getPet(id: number): Pet | undefined {
  return pets.find((pet) => pet.id === id);
}

export function addPet(pet: Pet) {
  pets.push(pet);
}
