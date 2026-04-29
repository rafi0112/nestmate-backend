const router = require('express').Router();
const reviewsController = require('../controllers/reviews.controller');

router.get('/reviews', reviewsController.listReviews);
router.post('/reviews', reviewsController.createReview);

module.exports = router;