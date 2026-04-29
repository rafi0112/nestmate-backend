const router = require('express').Router();
const roommateController = require('../controllers/roommate.controller');

router.post('/roommate', roommateController.createListing);
router.get('/roommate', roommateController.listListings);
router.get('/roommate/:id', roommateController.getListingById);
router.put('/roommate/:id', roommateController.updateListing);
router.delete('/roommate/:id', roommateController.deleteListing);

module.exports = router;