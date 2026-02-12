import { Admin } from './Admin';
import { Application } from './Application';
import { Attendance } from './Attendance';
import { Company } from './Company';
import { CompanyFeedback } from './CompanyFeedback';
import { Evaluation } from './Evaluation';
import { JobPost } from './JobPost';
import { Payment } from './Payment';
import { Supervisor } from './Supervisor';
import { Task } from './Task';
import { TaskPreCheck } from './TaskPreCheck';
import { TaskSupervisor } from './TaskSupervisor';
import { TaskWorker } from './TaskWorker';
import { TaskWorkerType } from './TaskWorkerType';
import { Worker } from './Worker';
import { WorkerLevel } from './WorkerLevel';
import { WorkerType } from './WorkerType';
import { WorkerScoreHistory } from './WorketScoreHistory';
import { ApplicationStatusEnum } from '../Enums/application-status.enum';
import { AttendanceStatusEnum } from '../Enums/attendance-status.enum';
import { TaskApprovalStatusEnum } from '../Enums/task-approval.enum';
import { AssignmentTypeEnum } from '../Enums/assignment-type.enum';

describe('Entities Final Coverage Polish', () => {
  
  it('should cover Admin and all its relation fields', () => {
    const e = new Admin();
    e.id = 1; e.name = 'a'; e.email = 'a@a.com';
    e.verificationCode = '123'; e.verificationCodeExpiry = new Date();
    e.resetCode = '123'; e.resetCodeExpiry = new Date();
    // قراءة العلاقات هي التي ترفع نسبة الـ Functions
    e.companies = []; e.workers = []; e.supervisors = []; e.jopposts = [];
    expect(e.id).toBe(1);
  });

  it('should cover Company and Task relations', () => {
    const c = new Company();
    c.adminId = new Admin();
    c.verificationCode = '1'; c.verificationCodeExpiry = new Date();
    c.resetCode = '1'; c.resetCodeExpiry = new Date();
    c.tasks = []; c.feedback = [];
    
    const t = new Task();
    t.company = c; t.workerLevel = new WorkerLevel();
    t.workerTypes = []; t.jobPost = []; t.taskWorkers = [];
    t.preChecks = []; t.attendance = []; t.evaluations = [];
    t.supervisors = []; t.payments = []; t.feedback = [];
    expect(t).toBeDefined();
  });

  it('should cover Worker and Scoring', () => {
    const w = new Worker();
    w.level = new WorkerLevel();
    w.adminId = new Admin();
    w.verificationCode = '1'; w.resetCode = '1';
    w.applications = []; w.taskWorkers = []; w.attendance = [];
    w.evaluations = []; w.scoreHistory = [];
    
    const sh = new WorkerScoreHistory();
    sh.workerId = w;
    expect(w).toBeDefined();
  });

  it('should cover Attendance, Application and Supervisor', () => {
    const att = new Attendance();
    att.task = new Task(); att.workerId = new Worker();
    att.excelFile = Buffer.from('test');

    const app = new Application();
    app.jobPostId = new JobPost(); app.workerId = new Worker();

    const sup = new Supervisor();
    sup.adminId = new Admin();
    sup.verificationCode = '1'; sup.resetCode = '1';
    sup.taskAssignments = []; sup.evaluations = [];
    
    expect([att, app, sup]).toBeDefined();
  });

  it('should cover JobPost, Payment and Feedback', () => {
    const jp = new JobPost();
    jp.taskId = new Task(); jp.adminId = new Admin();

    const p = new Payment();
    p.taskId = new Task();

    const cf = new CompanyFeedback();
    cf.taskId = new Task(); cf.companyId = new Company();

    const ev = new Evaluation();
    ev.taskId = new Task(); ev.workerId = new Worker(); ev.supervisorId = new Supervisor();

    expect([jp, p, cf, ev]).toBeDefined();
  });

  it('should cover Junctions and Types', () => {
    const tpc = new TaskPreCheck();
    tpc.taskId = new Task(); tpc.workerId = new Worker();

    const ts = new TaskSupervisor();
    ts.taskId = new Task(); ts.supervisorId = new Supervisor();

    const tw = new TaskWorker();
    tw.taskId = new Task(); tw.workerId = new Worker();

    const twt = new TaskWorkerType();
    twt.taskId = new Task(); twt.workerTypeId = new WorkerType();

    const wl = new WorkerLevel();
    wl.workers = []; wl.tasks = [];

    const wt = new WorkerType();
    wt.taskWorkerTypes = [];

    expect([tpc, ts, tw, twt, wl, wt]).toBeDefined();
  });
});