export interface Member {
  id: string;
  employee_id: string;
  email: string;
  last_name: string;
  first_name: string;
  last_name_en: string | null;
  first_name_en: string | null;
  branch: string;
  branch_name: string;
  registration_status: string;
  is_active: boolean;
  supervisor_info: {
    leader: null | {
      id: string;
      employee_id: string;
      name: string;
    };
    subleader: null | {
      id: string;
      employee_id: string;
      name: string;
    };
    supervisor_type?: string;
  };
  roles: {
    is_leader: boolean;
    is_admin: boolean;
  };
  created_by?: string;
  updated_by?: string;
  [key: string]: any;
} 