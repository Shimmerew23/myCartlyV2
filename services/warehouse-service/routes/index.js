const express = require('express');
const {
  authenticate, requireAdmin, requireWarehouse,
} = require('../middleware/index');

const warehouseCtrl = require('../controllers/warehouseController');
const carrierCtrl = require('../controllers/carrierController');

// Public carrier routes
const carrierRouter = express.Router();
carrierRouter.get('/', carrierCtrl.getActiveCarriers);

// Admin warehouse management routes
const adminWarehouseRouter = express.Router();
adminWarehouseRouter.use(authenticate, requireAdmin);
adminWarehouseRouter.get('/warehouses', warehouseCtrl.getWarehouses);
adminWarehouseRouter.post('/warehouses', warehouseCtrl.createWarehouse);
adminWarehouseRouter.put('/warehouses/:id', warehouseCtrl.updateWarehouse);
adminWarehouseRouter.delete('/warehouses/:id', warehouseCtrl.deleteWarehouse);
adminWarehouseRouter.get('/carriers', carrierCtrl.getAllCarriers);
adminWarehouseRouter.post('/carriers', carrierCtrl.createCarrier);
adminWarehouseRouter.put('/carriers/:id', carrierCtrl.updateCarrier);
adminWarehouseRouter.delete('/carriers/:id', carrierCtrl.deleteCarrier);

// Warehouse staff scan routes
const warehouseOpRouter = express.Router();
warehouseOpRouter.use(authenticate, requireWarehouse);
warehouseOpRouter.get('/scan', warehouseCtrl.scanOrder);
warehouseOpRouter.put('/orders/:id/check-in', warehouseCtrl.checkInParcel);

module.exports = { carrierRouter, adminWarehouseRouter, warehouseOpRouter };
