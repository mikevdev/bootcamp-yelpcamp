var express = require("express");
var router = express.Router({ mergeParams: true });
var Campground = require("../models/campground");
var Comment = require("../models/comment");
var middleware = require("../middleware");

//Comments New
router.get("/new", middleware.isLoggedIn, function(req, res) {
	Campground.findById(req.params.id, function(err, campground) {
		if (err) {
			console.log(err);
		} else {
			res.render("./comments/new", { campground: campground });
		}
	});
});

//Comments Create
router.post("/", middleware.isLoggedIn, function(req, res) {
	Campground.findById(req.params.id, function(err, campground) {
		if (err) {
			console.log(err);
			res.redirect("/campgrounds");
		} else {
			Comment.create(req.body.comment, function(err, createdComment) {
				if (err) {
					req.flash("error", "Something went wrong");
					console.log(err);
				} else {
					//add username and id to comment
					createdComment.author.id = req.user._id;
					createdComment.author.username = req.user.username;
					createdComment.save();
					campground.comments.push(createdComment);
					campground.save(function(err, data) {
						if (err) {
							console.log(err);
						} else {
							req.flash("success", "Successfully added comment");
							res.redirect("/campgrounds/" + req.params.id);
						}
					});
				}
			});
		}
	});
});

//Comments Edit
router.get("/:comment_id/edit", middleware.checkCommentOwnership, function(req, res) {
	Campground.findById(req.params.id, function(err, campground) {
		if (err || !campground) {
			req.flash("error", "No campground found");
			res.redirect("back");
		} else {
			Comment.findById(req.params.comment_id, function(err, comment) {
				if (err) {
					res.redirect("back");
				} else {
					res.render("../views/comments/edit", { campground: campground, comment: comment });
				}
			});
		}
	});
});

//Comments Update
router.put("/:comment_id", middleware.checkCommentOwnership, function(req, res) {
	Comment.findByIdAndUpdate(req.params.comment_id, req.body.comment, function(err, updatedComment) {
		if (err) {
			res.redirect("back");
		} else {
			res.redirect("/campgrounds/" + req.params.id);
		}
	});
});

//COMMENT DESTROY ROUTE

router.delete("/:comment_id", middleware.checkCommentOwnership, function(req, res) {
	Comment.findByIdAndRemove(req.params.comment_id, function(err, removedComment) {
		if (err) {
			res.redirect("back");
		} else {
			Campground.findByIdAndUpdate(req.params.id, { $pull: { comments: req.params.comment_id } }, function(err) {
				if (err) {
					res.redirect("back");
				} else {
					req.flash("success", "Comment deleted");
					res.redirect("/campgrounds/" + req.params.id);
				}
			});
		}
	});
});

module.exports = router;
