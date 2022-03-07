const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const mongoose = require('mongoose');

const Workshop = require('../models/Workshop');
const Teacher = require('../models/Teacher');
const User = require('../models/User');
const { checkPermission } = require('../utils/utils');
const { authenticateAdmin } = require('../express_middlewares/adminAuth');
const { SITE_VERSION } = require('./../config/index.js')


const router = new express.Router();

router.post('/', authenticateAdmin, async (req, res) => {
    try {
        if (!checkPermission(req.admin, 'addWorkshop', res)) {
            return;
        }

        const validFields = ["capacity", "title", "price", "isRegOpen", "description", "times", "teachers"];
        const finalBody = {};
        validFields.forEach(field => {
            finalBody[field] = req.body[field];
        });
        const workshop = new Workshop(finalBody);
        for (const obj of workshop.teachers) {
            const id = obj.id;
            const teacher = await Teacher.findById(id);
            if (!teacher) {
                res.status(404).send("Teacher not found");
            }
            obj.name = teacher.fullName;
        }
        await workshop.save();

        res.status(201).send(workshop)
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

router.get("/manage", authenticateAdmin, async (req, res) => {
    try {
        if (!checkPermission(req.admin, 'getWorkshop', res)) {
            return;
        }
        const workshops = await Workshop.find({});

        let result = [];
        for (const workshop of workshops) {
            await workshop.populate('participants').execPopulate()
            const count = await workshop.participantsCount;
            result = result.concat({
                workshop,
                participants: workshop.participants,
                participantsCount: count
            });
        }

        res.send(result);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const workshops = await Workshop.find({});
        res.send(workshops);
    } catch (err) {
        res.status(500).send({ err: err.message });
    }
});

router.get('/manage/:id', authenticateAdmin, async (req, res) => {
    try {
        if (!checkPermission(req.admin, 'getWorkshop', res)) {
            return;
        }

        const workshop = await Workshop.findById(req.params.id);
        if (!workshop) {
            res.status(404).send();
            return;
        }

        await workshop.populate('participants').execPopulate();
        let teachers = [];
        for (const teacher of workshop.teachers) {
            teachers = teachers.concat(await Teacher.findById(teacher.id));
        }

        const count = await workshop.participantsCount;
        res.send({ workshop, participants: workshop.participants, teachers, participantsCount: count });
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

router.get("/:id", async (req, res) => {
    const workshop = await Workshop.findById(req.params.id);
    if (!workshop) {
        res.status(404).send();
        return;
    }
    let teachers = [];
    for (const teacher of workshop.teachers) {
        teachers = teachers.concat(await Teacher.findById(teacher.id));
    }
    res.send({ workshop, teachers });
})

router.patch('/manage/:id', authenticateAdmin, async (req, res) => {
    try {
        if (!checkPermission(req.admin, 'editWorkshop', res)) {
            return;
        }

        const workshop = await Workshop.findById(req.params.id);
        if (!workshop) {
            res.status(404).send();
            return;
        }

        const validUpdates = ['capacity', 'title', 'isRegOpen', 'description', 'teachers', 'price', 'times'];
        const updates = Object.keys(req.body);
        if (!updates.every(element => validUpdates.includes(element))) {
            res.status(400).send();
            return;
        }

        updates.forEach(update => workshop[update] = req.body[update]);
        await workshop.save()
        res.send(workshop);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

router.delete('/manage/:id', authenticateAdmin, async (req, res) => {
    if (!checkPermission(req.admin, 'deleteWorkshop', res)) {
        return;
    }
    const workshop = await Workshop.findById(req.params.id);
    if (!workshop) {
        res.status(404).send();
        return;
    }
    await workshop.populate('participants').execPopulate();
    for (const participant of workshop.participants) {
        participant.workshops.splice(participant.workshops.indexOf({ workshop: req.params.id }), 1);
        await participant.save();
    }
    await Workshop.deleteOne(workshop);
    res.status(204).end()
});

router.put('/manage/:workshopId/user/:userId', authenticateAdmin, async (req, res) => {
    if (!checkPermission(req.admin, 'editWorkshop', res)) {
        return;
    }
    try {
        const workshop = await Workshop.findById(req.params.workshopId);
        if (!workshop) {
            res.status(404).send();
            return;
        }
        const user = await User.findById(req.params.userId);
        if (!user) {
            res.status(404).send();
            return;
        }
        if (workshop.isRegOpen) {
            user.workshops = user.workshops.concat({ workshop: workshop._id });
            await user.save();
            await workshop.save();
        }
        res.status(200).send();
    } catch (err) {
        res.status(500).send(err);
    }
});

router.delete('/manage/:workshopId/user/:userId', authenticateAdmin, async (req, res) => {
    if (!checkPermission(req.admin, 'editWorkshop', res)) {
        return;
    }
    try {
        const workshop = await Workshop.findById(req.params.workshopId);
        if (!workshop) {
            res.status(404).send();
            return;
        }
        const user = await User.findById(req.params.userId);
        if (!user) {
            res.status(404).send();
            return;
        }

        user.workshops = user.workshops.filter(val => {
            return val._id === workshop._id;
        });

        await user.save();
        res.status(200).send();
    } catch (err) {
        res.status(500).send(err.message);
    }
});


//Upload file endpoint(s)
const upload = multer({
    limits: {
        fileSize: 10000000
    },
    fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            cb(new Error('لطفا تصویر آپلود کنید'));
        }
        cb(undefined, true);
    }
});

router.get('/pic/:id',async(req,res)=>{
    try{
        if (fs.existsSync(".."+"/uploads/"+SITE_VERSION+"/workshops/"+req.params.id+"/mainPic.png"))
        {
            res.status(200).sendFile(path.join(__dirname, '../..'+ "/uploads/"+SITE_VERSION+"/workshops/"+req.params.id+"/mainPic.png"));
        }
        else
        {
            res.status(404).send({message:"File Not Found"})
        }
    }catch(error){
        res.status(400).send({message:"Internal error"})
    }
})

router.get('/pic/:workshop/:id',async(req,res)=>{
    try{
        if (fs.existsSync(".."+"/uploads/"+SITE_VERSION+"/workshops/"+req.params.workshop+"/"+ req.params.id +".png"))
        {
            res.status(200).sendFile(path.join(__dirname, '../..'+ "/uploads/"+SITE_VERSION+"/workshops/"+req.params.workshop+"/" + req.params.id +".png"));
        }
        else
        {
            res.status(404).send({message:"File Not Found"})
        }
    }catch(error){
        res.status(400).send({message:"Internal error"})
    }
})

router.post('/pic/album/:id', authenticateAdmin, upload.array('pictures'), async (req, res) => {
    if (!checkPermission(req.admin, 'editWorkshop', res)) {
        return;
    }

    try {
        const workshop = await Workshop.findById(req.params.id);
        if (!workshop) {
            res.status(404).send();
            return;
        }

        for (const file of req.files) {
            const buffer = await sharp(file.buffer).resize({ width: 1280, height: 960 }).png().toBuffer();
            const filePath = path.resolve(path.join("../uploads", `${SITE_VERSION}`, "workshops", req.params.id, "album"));

            if (!fs.existsSync(filePath)) {
                fs.mkdirSync(filePath, { recursive: true }, (err) => {
                    if (err) {
                        throw new Error(err);
                    }
                });
            }

            const picId = new mongoose.Types.ObjectId();
            fs.writeFileSync(path.join(filePath, picId.toHexString() + ".png"), buffer, (err) => {
                if (err) {
                    throw new Error(err);
                }
            });

            workshop.album = workshop.album.concat({
                _id: picId,
                albumPicPath: path.join(filePath, picId.toHexString() + ".png")
            });
        }

        await workshop.save();

        res.send(workshop);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
}, (err, req, res) => {
    res.status(400).send({ error: err.message });
});

router.delete('/pic/album/:id/:picid', authenticateAdmin, async (req, res) => {
    if (!checkPermission(req.admin, 'editWorkshop', res)) {
        return;
    }

    try {
        const workshop = await Workshop.findOne({ _id: req.params.id, 'album._id': req.params.picid });
        if (!workshop) {
            res.status(404).send();
            return;
        }

        fs.unlinkSync(path.resolve(path.join("../uploads", `${SITE_VERSION}`, "workshops", req.params.id, "album", req.params.picid + '.png')), (err) => {
            if (err) {
                throw new Error(err);
            }
        });

        workshop.album = workshop.album.filter((picObj) => {
            return picObj._id.toHexString() !== req.params.picid;
        });
        await workshop.save();

        res.send(workshop);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

router.post('/pic/:id', authenticateAdmin, upload.single('mainPic'), async (req, res) => {
    if (!checkPermission(req.admin, 'editWorkshop', res)) {
        return;
    }
    try {
        const workshop = await Workshop.findById(req.params.id);
        if (!workshop) {
            res.status(404).send();
            return;
        }

        const buffer = await sharp(req.file.buffer).resize({ width: 1280, height: 960 }).png().toBuffer();
        const filePath = path.resolve(path.join("../uploads", `${SITE_VERSION}`, "workshops", req.params.id));
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(filePath, { recursive: true }, (err) => {
                if (err) {
                    throw new Error(err);
                }
            });
        }
        fs.writeFileSync(path.join(filePath, "mainPic.png"), buffer, (err) => {
            if (err) {
                throw new Error(err);
            }
        });

        workshop.picPath = path.join(filePath, "mainPic.png");
        await workshop.save();

        res.send(workshop);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
}, (err, req, res) => {
    res.status(400).send({ error: err.message });
});

router.delete('/pic/:id', authenticateAdmin, async (req, res) => {
    if (!checkPermission(req.admin, 'editWorkshop', res)) {
        return;
    }

    try {
        const workshop = await Workshop.findById(req.params.id);
        if (!workshop || !workshop.picPath) {
            res.status(404).send();
            return;
        }

        fs.unlink(path.resolve(path.join("../uploads", SITE_VERSION, "workshops", req.params.id, "mainPic.png")), (err) => {
            if (err) {
                throw new Error(err);
            }
        });

        workshop.picPath = '';
        await workshop.save();

        res.send(workshop);

    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

module.exports = router;