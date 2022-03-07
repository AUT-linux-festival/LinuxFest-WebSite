const mongoose = require('mongoose');
const persianize = require('persianize');
const { BASEURL } = require('./../config/index.js')

const schema = mongoose.Schema({
    fullName: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        validate(values) {
            for (const value of values.split(' ')) {
                if (!persianize.validator().alpha(value)) {
                    throw new Error('نام معتبر نمیباشد')
                }
            }
        }
    },
    description: {
        type: String
    },
    imagePath: {
        type: String
    }
}, {
    timestamps: true
});

schema.virtual('workshops', {
    ref: 'Workshop',
    localField: '_id',
    foreignField: 'teachers.teacher'
})

schema.methods.toJSON = function () {
    const teacher = this;
    const teacherObject = teacher.toObject();

    const url = `/${BASEURL}/teachers/pic/${teacherObject._id}`;
    if (teacherObject.imagePath) {
        delete teacherObject.imagePath;
        teacherObject.picUrl = url;
    }

    return teacherObject;
};

const Teacher = new mongoose.model('Teacher', schema);

module.exports = Teacher;