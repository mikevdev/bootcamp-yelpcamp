var express = require("express");
var router = express.Router();
var User = require("../models/user");
var passport = require("passport");
var Campground = require("../models/campground");
var async = require("async");
var nodemailer = require("nodemailer");
var crypto = require("crypto"); //part of node, no install needed

//root route
router.get("/", function(req, res) {
	res.render("landing");
});

//show register form
router.get("/register", function(req, res) {
	res.render("register", { page: "register" });
});

//handle sign up logic
router.post("/register", function(req, res) {
	User.register(
		new User({
			username: req.body.username,
			avatar: req.body.avatar,
			firstName: req.body.firstName,
			lastName: req.body.lastName,
			email: req.body.email
		}),
		req.body.password,
		function(err, user) {
			if (err) {
				req.flash("error", err.message);
				return res.redirect("register");
			}
			passport.authenticate("local")(req, res, function() {
				req.flash("success", "Welcome to YelpCamp " + user.username);
				res.redirect("/campgrounds");
			});
		}
	);
});

//show login form
router.get("/login", function(req, res) {
	res.render("login", { page: "login" });
});

//handling login logic - MODIFIED VERSION, NOT PERFECT FOR ERRORS
// IMPLEMENT CUSTOM CALLBACK IN PRODUCTION
router.post("/login", passport.authenticate("local"), function(req, res) {
	User.findById(req.user._id, function(err, user) {
		user.resetPasswordToken = undefined;
		user.resetPasswordExpires = undefined;
		user.save(function(err) {
			if (err) {
				console.log(err);
			}
			res.redirect("/campgrounds");
		});
	});
});

// THIS IS THE ORIGINAL LOGIN FUNCTION, THE ONE ABOVE IS MODIFIED AND CONTAINS
// TOKEN RESET IF USER LOGINS TO HIS ACCOUNT AFTER REQUESTING PASSWORD RESET
// router.post(
// 	"/login",
// 	passport.authenticate("local", {
// 		successRedirect: "/campgrounds",
// 		failureRedirect: "/login"
// 	}),
// 	function(req, res) {}
// );

//logout route
router.get("/logout", function(req, res) {
	req.logout();
	req.flash("success", "Logged You Out!");
	res.redirect("/campgrounds");
});

//forgot password
router.get("/forgot", function(req, res) {
	res.render("forgot");
});

router.post("/forgot", function(req, res, next) {
	async.waterfall(
		[
			function(done) {
				//creating random 20 character token
				crypto.randomBytes(20, function(err, buf) {
					var token = buf.toString("hex");
					done(err, token);
				});
			},
			function(token, done) {
				User.findOne({ email: req.body.email }, function(err, user) {
					if (!user) {
						req.flash("error", "No account with that email address exists!");
						return res.redirect("/forgot");
					}
					user.resetPasswordToken = token;
					user.resetPasswordExpires = Date.now() + 3600000; //1 hour=3600000ms
					user.save(function(err) {
						done(err, token, user);
					});
				});
			},
			function(token, user, done) {
				var smtpTransport = nodemailer.createTransport({
					service: "Yandex",
					auth: {
						user: process.env.YANDEXEMAIL,
						pass: process.env.YANDEXPW
					}
				});
				var mailOptions = {
					to: user.email,
					from: process.env.YANDEXEMAIL,
					subject: "YelpCamp Password Reset",
					text:
						"You are receiving this because you (or someone else) have requested the reset of the password\n" +
						"Please click on the following link, or paste this into your browser to complete the process\n" +
						"http://" +
						req.headers.host +
						"/reset/" +
						token +
						"\n\n" +
						"If you did not request this, please ignore this email and your password will remain unchanged"
				};
				smtpTransport.sendMail(mailOptions, function(err) {
					console.log("mail sent");
					req.flash("success", "An email has been sent to " + user.email + " with further instructions.");
					done(err, "done");
				});
			}
		],
		function(err) {
			if (err) return next(err);
			res.redirect("/forgot");
		}
	);
});

router.get("/reset/:token", function(req, res) {
	User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(
		err,
		user
	) {
		if (!user) {
			req.flash("error", "Password reset link is invalid or has expired.");
			return res.redirect("/forgot");
		}
		res.render("reset", { token: req.params.token });
	});
});

router.post("/reset/:token", function(req, res) {
	async.waterfall(
		[
			function(done) {
				User.findOne(
					{ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } },
					function(err, user) {
						if (!user) {
							req.flash("error", "Password reset link is invalid or has expired");
							return res.redirect("back");
						}
						if (req.body.password === req.body.confirm) {
							user.setPassword(req.body.password, function(err) {
								user.resetPasswordToken = undefined;
								user.resetPasswordExpires = undefined;
								user.save(function(err) {
									req.logIn(user, function(err) {
										done(err, user);
									});
								});
							});
						} else {
							req.flash("error", "Passwords do not match.");
							return res.redirect("back");
						}
					}
				);
			},
			function(user, done) {
				var smtpTransport = nodemailer.createTransport({
					service: "Yandex",
					auth: {
						user: process.env.YANDEXEMAIL,
						pass: process.env.YANDEXPW
					}
				});
				var mailOptions = {
					to: user.email,
					from: process.env.YANDEXEMAIL,
					subject: "Your password has been changed",
					text:
						"Hello,\n\n" +
						"This is a confirmation that the password for your account " +
						user.email +
						" has been updated."
				};
				smtpTransport.sendMail(mailOptions, function(err) {
					req.flash("success", "Success! Your password has been changed.");
					done(err);
				});
			}
		],
		function(err) {
			if (err) {
				req.flash("error", "Something went wrong!");
			} else {
				res.redirect("/campgrounds");
			}
		}
	);
});

//USER PROFILE

router.get("/users/:id", function(req, res) {
	User.findById(req.params.id, function(err, foundUser) {
		if (err) {
			req.flash("error", "Something went wrong");
			res.redirect("/");
		} else {
			Campground.find().where("author.id").equals(foundUser._id).exec(function(err, campgrounds) {
				if (err) {
					req.flash("error", "Something went wrong");
					res.redirect("/");
				} else {
					res.render("users/show", { user: foundUser, campgrounds: campgrounds });
				}
			});
		}
	});
});

module.exports = router;
