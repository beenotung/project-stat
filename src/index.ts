import * as util from 'util';

const fetch = require('node-fetch');

const headers = { Authorization: 'Basic Ym' };

export function errorP<A>(p: Promise<A>): Promise<A> {
  return p
    .then(x => {
      console.error(util.inspect(x, { depth: 999 }));
      return x;
    })
    .catch(x => {
      console.error(x);
      return Promise.reject(x);
    });
}

export function logP<A>(p: Promise<A>): Promise<A> {
  return p
    .then(x => {
      console.log(util.inspect(x, { depth: 999 }));
      return x;
    })
    .catch(x => {
      console.error(x);
      return Promise.reject(x);
    });
}

interface Project {
  owner: string;
  repo: string;
  num_author: number;
  num_commit: number;
}

function countProject(owner: string, repo: string): Promise<Project> {
  return fetch(
    `https://api.github.com/repos/${owner}/${repo}/stats/contributors`,
    { headers },
  )
    .then(res => res.json())
    .then(xs => {
      xs = toArray(xs);
      let num_author: number;
      let num_commit: number;
      if (!xs.map || !xs.length) {
        num_author = 0;
        num_commit = 0;
      } else {
        num_author = xs.length;
        num_commit = xs.map(x => x.total).reduce((acc, c) => acc + c, 0);
      }
      const project: Project = { owner, repo, num_author, num_commit };
      return project;
    });
}

// logP(countProject('zhukov', 'webogram'));

function toArray(xs) {
  return Array.prototype.slice.call(xs);
}

function compare(a, b) {
  /* tslint:disable */
  return a == b ? 0 : a > b ? 1 : -1;
  /* tslint:enable */
}

interface Projects {
  projects: Project[];
  idx: { [owner_repo: string]: boolean };
}

function addProject(projects: Projects, project: Project): Projects {
  const name = `${project.owner}/${project.repo}`;
  if (!projects.idx[name]) {
    projects.projects.push(project);
    projects.idx[name] = true;
  }
  return projects;
}

function exploreProjects(since = 0, projects: Projects = {
  idx: {}, projects: [],
}): Promise<Projects> {
  return fetch(`https://api.github.com/repositories?since=${since}`, {
    headers,
  })
    .then(res => res.json().catch(e => Promise.reject(res.text())))
    .then(xs => {
      xs = toArray(xs);
      console.error(`checking ${xs.length} projects since ${since}...`);
      return Promise.all<Project>(
        xs.map(x => {
          const owner = x.owner.login;
          const repo = x.name;
          // return errorP<project>(countProject(owner, repo));
          return countProject(owner, repo);
        }),
      );
    })
    .then(xs => xs.filter(x => x.num_author > 0 && x.num_commit > 0))
    .then(xs => {
      if (xs.length === 0) {
        return projects;
      }
      xs.forEach(x => addProject(projects, x));
      console.log(JSON.stringify(xs));
      const sorted = projects.projects
        .map(x => x)
        .sort((a, b) => {
          const res = compare(a.num_author, b.num_author);
          return res === 0 ? compare(a.num_commit, b.num_commit) : res;
        });
      const bests = [];
      for (let i = Math.sqrt(projects.projects.length); i > 0; i--) {
        bests.push(sorted.pop());
      }
      console.error('best ' + bests.length + ':', bests);
      return exploreProjects(since + xs.length, projects);
    });
}

logP(exploreProjects());
