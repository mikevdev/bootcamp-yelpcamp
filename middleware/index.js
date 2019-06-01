//all the middleware goes here
var Campground = require("../models/campground");
var Comment = require("../models/comment");
var Review = require("../models/review");
var middlewareObj = {};

middlewareObj.checkCampgroundOwnership = function(req, res, next) {
	if (req.isAuthenticated()) {
		Campground.findById(req.params.id, function(err, campground) {
			if (err || !campground) {
				req.flash("error", "Campground not found");
				res.redirect("back");
			} else {
				if (campground.author.id.equals(req.user._id) || req.user.isAdmin) {
					//campground.author.id is an object, req.user.id is a string
					next();
				} else {
					req.flash("error", "You don't have permission to do that!");
					res.redirect("back");
				}
			}
		});
	} else {
		req.flash("error", "You need to be logged in to do that!");
		res.redirect("back");
	}
};

middlewareObj.checkCommentOwnership = function(req, res, next) {
	if (req.isAuthenticated()) {
		Comment.findById(req.params.comment_id, function(err, comment) {
			if (err || !comment) {
				req.flash("error", "Comment not found");
				res.redirect("back");
			} else {
				if (comment.author.id.equals(req.user._id) || req.user.isAdmin) {
					//comment.author.id is an object, req.user.id is a string
					next();
				} else {
					req.flash("error", "You don't have permission to do that");
					res.redirect("back");
				}
			}
		});
	} else {
		req.flash("error", "You need to be logged in to do that!");
		res.redirect("back");
	}
};

middlewareObj.isLoggedIn = function(req, res, next) {
	if (req.isAuthenticated()) {
		return next();
	}
	req.flash("error", "You need to be logged in to do that!");
	res.redirect("/login");
};

middlewareObj.checkReviewOwnership = function(req, res, next) {
	if (req.isAuthenticated()) {
		Review.findById(req.params.review_id, function(err, foundReview) {
			if (err || !foundReview) {
				res.redirect("back");
			} else {
				if (foundReview.author.id.equals(req.user._id)) {
					next();
				} else {
					req.flash("error", "You don't have permission to do that");
					res.redirect("back");
				}
			}
		});
	} else {
		req.flash("error", "You need to be logged in to do that");
		res.redirect("back");
	}
};

middlewareObj.checkReviewExistence = function(req, res, next) {
	if (req.isAuthenticated()) {
		Campground.findById(req.params.id).populate("reviews").exec(function(err, foundCampground) {
			if (err || !foundCampground) {
				req.flash("error", "Campground not found.");
				res.redirect("back");
			} else {
				var foundUserReview = foundCampground.reviews.some(function(review) {
					return review.author.id.equals(req.user._id);
				});
				if (foundUserReview) {
					req.flash("error", "You already wrote a review.");
					return res.redirect("/campgrounds/" + foundCampground_id);
				}
				next();
			}
		});
	} else {
		req.flash("error", "You need to login first");
		res.redirect("back");
	}
};

module.exports = middlewareObj;
