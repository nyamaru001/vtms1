const { Op } = require('sequelize');
const { VehicleRequest, Trip, FuelRequest } = require('../models');

async function nextRequestNumber() {
  const year = new Date().getFullYear();
  const count = await VehicleRequest.count();
  return `REQ-${year}-${String(count + 1).padStart(5, '0')}`;
}

async function nextTripNumber() {
  const year = new Date().getFullYear();
  const count = await Trip.count();
  return `TRIP-${year}-${String(count + 1).padStart(5, '0')}`;
}

async function nextVoucherNumber() {
  const count = await FuelRequest.count({ where: { voucherNumber: { [Op.ne]: null } } });
  return `FV-${String(count + 1).padStart(6, '0')}`;
}

module.exports = { nextRequestNumber, nextTripNumber, nextVoucherNumber };
