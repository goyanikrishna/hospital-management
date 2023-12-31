import Appointment from '../models/appointment';
import Rooms from '../models/room';
import Patient from '../models/patient';
import APIError from '../helpers/APIError';
import httpStatus from 'http-status';
import { ErrMessages, SuccessMessages } from '../helpers/AppMessages';

async function c_appoint(req, res, next) {
  try {
    let { reason, time, email, doctor, room } = req.body;

    let find_room = await Rooms.findOneAndUpdate(
      { name: room },
      { availability: false }
    );
    if (!find_room)
      return next(
        new APIError(ErrMessages.roomNotFound, httpStatus.UNAUTHORIZED, true)
      );

    let find_patient = await Patient.findOne({ email });
    if (!find_patient)
      return next(
        new APIError(ErrMessages.patientNotFound, httpStatus.UNAUTHORIZED, true)
      );

    let appointments = await Appointment.create({
      reason,
      time,
      doctor,
      patient: { find_patient }._id,
      roomId: find_room._id,
    });

    if (!appointments)
      return next(
        new APIError(ErrMessages.dataNotCreated, httpStatus.UNAUTHORIZED, true)
      );

    next(SuccessMessages.createAppointment);
  } catch (err) {
    return next(
      new APIError(err.message, httpStatus.INTERNAL_SERVER_ERROR, true, err)
    );
  }
}

async function list_appoint(req, res, next) {
  try {
    let srt = await Appointment.find({}).select(
      '-_id reason time doctorId patienId Room'
    );

    if (!srt)
      return next(
        new APIError(
          ErrMessages.appointmentNotFound,
          httpStatus.UNAUTHORIZED,
          true
        )
      );

    next(srt);
  } catch (err) {
    return next(
      new APIError(err.message, httpStatus.INTERNAL_SERVER_ERROR, true, err)
    );
  }
}

async function checkout_patient(req, res, next) {
  try {
    let email = req.query.email;

    let patients = await Patient.find({
      email,
    }).select('_id first_name');

    if (!patients)
      return next(
        new APIError(ErrMessages.patientNotFound, httpStatus.UNAUTHORIZED, true)
      );

    let appoint = await Appointment.find({
      patientId: patients[0]._id,
    }).select('patientId Room');

    if (!appoint)
      return next(
        new APIError(
          ErrMessages.appointmentNotFound,
          httpStatus.UNAUTHORIZED,
          true
        )
      );

    let room = await Rooms.updateOne(
      { _id: appoint[0].Room },
      { available: false }
    );
    if (!room)
      return next(
        new APIError(
          ErrMessages.roomUpdateFailed,
          httpStatus.UNAUTHORIZED,
          true
        )
      );

    next(SuccessMessages.checkoutAppointment);
  } catch (err) {
    return next(
      new APIError(err.message, httpStatus.INTERNAL_SERVER_ERROR, true, err)
    );
  }
}

async function date_filter(req, res, next) {
  try {
    let { start, end } = req.query;
    const startDate = new Date(start); // Replace with your desired start date
    const endDate = new Date(end); // Replace with your desired end date

    let date = await Appointment.find({
      time: {
        $gte: startDate, // Greater than or equal to the start date
        $lte: new Date(endDate.getTime() + 86400000), // Less than or equal to the end date
      },
    });

    if (!date)
      return next(
        new APIError(ErrMessages.patientNotFound, httpStatus.UNAUTHORIZED, true)
      );

    next(date);
  } catch (err) {
    return next(
      new APIError(err.message, httpStatus.INTERNAL_SERVER_ERROR, true, err)
    );
  }
}

/**
 * list appointments
 */
async function listAppointments(req, res, next) {
  try {
    let { searchString, page_size = 10, page_number = 1 } = req.query;

    page_size = parseInt(page_size);
    page_number = parseInt(page_number);

    let select = '_id reason time doctor patient roomId';
    let filter = {};

    let searchFilter = {
      $or: [
        { reason: { $regex: searchString, $options: 'i' } },
        // { email: { $regex: searchString, $options: 'i' }}
      ],
    };

    if (searchString && searchString.length > 0) filter = { ...searchFilter };
    const totalRecords = await Appointment.find(filter).countDocuments();
    const page_count = totalRecords / page_size || 1;

    if (Math.ceil(page_count) < page_number) {
      page_number = 1;
    }

    let appointments = await Appointment.find(filter)
      .select(select)
      .sort({ reason: -1 })
      .skip((page_number - 1) * page_size)
      .limit(page_size);

    next({ appointments, totalRecords, page_count: Math.ceil(page_count) });
  } catch (err) {
    console.log(err);
    return next(
      new APIError(err.message, httpStatus.INTERNAL_SERVER_ERROR, true)
    );
  }
}

module.exports = {
  c_appoint,
  checkout_patient,
  list_appoint,
  date_filter,
  listAppointments,
};
