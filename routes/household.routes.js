const router = require('express').Router();
const householdController = require('../controllers/household.controller');

router.get('/households', householdController.getHousehold);
router.get('/households/all', householdController.listHouseholds);
router.post('/households', householdController.createHousehold);
router.post('/households/join', householdController.joinHousehold);
router.put('/households/:id', householdController.updateHousehold);

router.get('/groups', householdController.getGroups);
router.post('/groups', householdController.createGroup);
router.post('/groups/join', householdController.joinGroup);
router.put('/groups/:id', householdController.updateGroup);

module.exports = router;