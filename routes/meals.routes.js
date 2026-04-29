const router = require('express').Router();
const mealsController = require('../controllers/meals.controller');

router.get('/meals', mealsController.listMeals);
router.post('/meals', mealsController.upsertMeal);

module.exports = router;