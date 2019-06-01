var express = require("express");
var router = express.Router();
var Campground = require("../models/campground");
var Comment = require("../models/comment");
var Review = require("../models/review");
var middleware = require("../middleware");
var NodeGeocoder = require("node-geocoder");
var multer = require("multer");
var storage = multer.diskStorage({
	filename: function(req, file, callback) {
		callback(null, Date.now() + file.originalname);
	}
});

var imageFilter = function(req, file, cb) {
	// accept image files only
	if (!file.originalname.match(/\.(jpg|jpeg|png|gif|mp4)$/i)) {
		return cb(new Error("Only image files are allowed"), false);
	}
	cb(null, true);
};

var upload = multer({ storage: storage, fileFilter: imageFilter });

var cloudinary = require("cloudinary");
cloudinary.config({
	cloud_name: "dgymty1wx",
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET
});

var options = {
	provider: "google",
	httpAdapter: "https",
	apiKey: process.env.GEOCODER_API_KEY,
	formatter: null
};

var geocoder = NodeGeocoder(options);

//INDEX - show all campgrounds
router.get("/", function(req, res) {
	var perPage = 6;
	var pageQuery = parseInt(req.query.page);
	var pageNumber = pageQuery ? pageQuery : 1;
	var noMatch = null;
	if (req.query.search) {
		//to prevent any kind of DDOS attack and we are using a regex function here
		const regex = new RegExp(escapeRegex(req.query.search), "gi");
		Campground.find({ name: regex }).skip(perPage * pageNumber - perPage).exec(function(err, allCampgrounds) {
			Campground.count({ name: regex }).exec(function(err, count) {
				if (err) {
					console.log(err);
					res.redirect("back");
				} else {
					if (allCampgrounds.length < 1) {
						noMatch = "No campgrounds match that query, please try again";
					}
					res.render("campgrounds/index", {
						campgrounds: allCampgrounds,
						current: pageNumber,
						pages: Math.ceil(count / perPage),
						search: req.query.search
					});
				}
			});
		});
	} else {
		Campground.find({}).skip(perPage * pageNumber - perPage).limit(perPage).exec(function(err, allCampgrounds) {
			Campground.count().exec(function(err, count) {
				if (err) {
					console.log(err);
				} else {
					res.render("campgrounds/index", {
						campgrounds: allCampgrounds,
						current: pageNumber,
						pages: Math.ceil(count / perPage),
						noMatch: noMatch,
						search: false
					});
				}
			});
		});
	}
});

//CREATE - add a new campground to DB logic
router.post("/", middleware.isLoggedIn, upload.single("image"), function(req, res) {
	cloudinary.uploader.upload(req.file.path, function(result) {
		var name = req.body.name;
		var image = result.secure_url;
		var price = req.body.price;
		var description = req.body.description;
		var author = {
			id: req.user._id,
			username: req.user.username
		};

		geocoder.geocode(req.body.location, function(err, data) {
			if (err || !data.length) {
				req.flash("error", "Invalid address");
				return res.redirect("back");
			}
			var lat = data[0].latitude;
			var lng = data[0].longitude;
			var location = data[0].formattedAddress;
			var newCampground = {
				name: name,
				image: image,
				price: price,
				description: description,
				location: location,
				lat: lat,
				lng: lng,
				author: author
			};
			Campground.create(newCampground, function(err, campground) {
				if (err) {
					req.flash("error", err.message);
					res.redirect("back");
				} else {
					res.redirect("/campgrounds/" + campground._id);
				}
			});
		});
	});
});

//NEW - show form to create new campground
router.get("/new", middleware.isLoggedIn, function(req, res) {
	res.render("./campgrounds/new");
});

//SHOW - shows more info about one campground
router.get("/:id", function(req, res) {
	Campground.findById(req.params.id)
		.populate("comments")
		.populate({ path: "reviews", options: { sort: { createdAt: -1 } } })
		.exec(function(err, foundCampground) {
			if (err || !foundCampground) {
				req.flash("error", "Campground not found");
				res.redirect("/campgrounds");
			} else {
				res.render("./campgrounds/show", { campground: foundCampground });
			}
		});
});

// EDIT CAMPGROUND ROUTE

router.get("/:id/edit", middleware.checkCampgroundOwnership, function(req, res) {
	Campground.findById(req.params.id, function(err, campground) {
		if (err) {
			res.redirect("/campgrounds");
		} else {
			res.render("./campgrounds/edit", { campground: campground });
		}
	});
});

//UPDATE Campground Route

router.put("/:id", middleware.checkCampgroundOwnership, function(req, res) {
	geocoder.geocode(req.body.location, function(err, data) {
		if (err || !data.length) {
			req.flash("error", "Invalid address");
			return res.redirect("back");
		}
		req.body.camp.lat = data[0].latitude;
		req.body.camp.lng = data[0].longitude;
		req.body.camp.location = data[0].formattedAddress;
		Campground.findByIdAndUpdate(req.params.id, req.body.camp, function(err, updatedCampground) {
			if (err) {
				req.flash("error", err.message);
				res.redirect("/campgrounds");
			} else {
				req.flash("success", "Successfully Updated!");
				res.redirect("/campgrounds/" + req.params.id);
			}
		});
	});
});

//DELETE Campground Route

router.delete("/:id", middleware.checkCampgroundOwnership, function(req, res) {
	Campground.findById(req.params.id, function(err, campground) {
		if (err) {
			res.redirect("/campgrounds");
		} else {
			Comment.remove({ _id: { $in: campground.comments } }, function(err) {
				if (err) {
					console.log(err);
					return res.redirect("/campgrounds");
				}
				Review.remove({ _id: { $in: campground.reviews } }, function(err) {
					if (err) {
						console.log(err);
						return res.redirect("/campgrounds");
					}
					campground.remove();
					req.flash("success", "Campground deleted successfully!");
					res.redirect("/campgrounds");
				});
			});
		}
	});

	// Campground.findByIdAndRemove(req.params.id, function(err, campgroundRemoved) {
	// 	if (err) {
	// 		res.redirect("/campgrounds");
	// 	} else {
	// 		Comment.deleteMany({ _id: { $in: campgroundRemoved.comments } }, function(err) {
	// 			if (err) {
	// 				res.redirect("/campgrounds");
	// 			} else {
	// 				res.redirect("/campgrounds");
	// 			}
	// 		});
	// 	}
	// });
});

//regex function for search
function escapeRegex(text) {
	return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

module.exports = router;
