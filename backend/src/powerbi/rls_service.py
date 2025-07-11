"""
Row Level Security (RLS) Service for Microsoft Fabric Embedded Backend
Manages RLS roles, rules, and dynamic security configurations
"""

import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from dataclasses import dataclass
from enum import Enum
import httpx

from ..auth.models import User
from ..auth.entra_auth import entra_auth_service
from ..config import get_settings
from ..utils.logger import security_logger

logger = logging.getLogger(__name__)
settings = get_settings()


class RLSRuleType(str, Enum):
    """Types of RLS rules"""
    STATIC = "static"
    DYNAMIC = "dynamic"
    CONDITIONAL = "conditional"


@dataclass
class RLSRole:
    """RLS Role definition"""
    name: str
    description: str
    rule_expression: str
    rule_type: RLSRuleType
    table_filters: List[str]
    is_active: bool = True


@dataclass
class RLSUserMapping:
    """User to RLS role mapping"""
    user_email: str
    user_id: str
    assigned_roles: List[str]
    entra_groups: List[str]
    effective_filters: Dict[str, Any]
    assigned_at: datetime
    assigned_by: str


class RLSService:
    """Service for managing Row Level Security in PowerBI"""
    
    def __init__(self):
        self.base_url = settings.powerbi_api_url
        self.workspace_id = settings.fabric_workspace_id
        self.dataset_id = settings.fabric_dataset_id
        
        # RLS Configuration Cache
        self._rls_roles_cache: Dict[str, RLSRole] = {}
        self._user_mappings_cache: Dict[str, RLSUserMapping] = {}
        self._dataset_security_cache: Dict[str, Dict[str, Any]] = {}
        
        # Predefined RLS roles for the application
        self._initialize_default_roles()
        
        logger.info("RLSService initialized with role-based security")
    
    def _initialize_default_roles(self) -> None:
        """Initialize default RLS roles based on application requirements"""
        
        # Admin Role - No restrictions (sees all data)
        admin_role = RLSRole(
            name="Admin",
            description="Administrator role with full data access",
            rule_expression="1=1",  # Always true, no filtering
            rule_type=RLSRuleType.STATIC,
            table_filters=[],
            is_active=True
        )
        
        # Role A - Regional data access
        role_a = RLSRole(
            name="RolA",
            description="Role A users with access to Region A data",
            rule_expression="[Region] = \"A\"",
            rule_type=RLSRuleType.STATIC,
            table_filters=["Sales", "Customers", "Products"],
            is_active=True
        )
        
        # Role B - Regional data access
        role_b = RLSRole(
            name="RolB", 
            description="Role B users with access to Region B data",
            rule_expression="[Region] = \"B\"",
            rule_type=RLSRuleType.STATIC,
            table_filters=["Sales", "Customers", "Products"],
            is_active=True
        )
        
        # Dynamic Role - User-specific filtering
        dynamic_role = RLSRole(
            name="Dynamic",
            description="Dynamic role based on user attributes",
            rule_expression="[UserEmail] = USERPRINCIPALNAME()",
            rule_type=RLSRuleType.DYNAMIC,
            table_filters=["UserAccess", "PersonalData"],
            is_active=True
        )
        
        # Public Role - Limited access
        public_role = RLSRole(
            name="Public",
            description="Public role with limited data access",
            rule_expression="[IsPublic] = TRUE()",
            rule_type=RLSRuleType.STATIC,
            table_filters=["PublicData"],
            is_active=True
        )
        
        # Store default roles
        self._rls_roles_cache = {
            role.name: role for role in [admin_role, role_a, role_b, dynamic_role, public_role]
        }
        
        logger.debug(f"Initialized {len(self._rls_roles_cache)} default RLS roles")
    
    async def get_user_rls_mapping(self, user: User) -> RLSUserMapping:
        """
        Get RLS mapping for a specific user
        
        Args:
            user: Authenticated user
            
        Returns:
            RLSUserMapping with roles and filters
        """
        
        try:
            # Check cache first
            if user.id in self._user_mappings_cache:
                cached_mapping = self._user_mappings_cache[user.id]
                # Return cached if recent (within 15 minutes)
                if (datetime.now() - cached_mapping.assigned_at).total_seconds() < 900:
                    return cached_mapping
            
            # Generate new mapping
            assigned_roles = self._map_user_to_rls_roles(user)
            effective_filters = self._build_effective_filters(user, assigned_roles)
            
            mapping = RLSUserMapping(
                user_email=user.email,
                user_id=user.id,
                assigned_roles=assigned_roles,
                entra_groups=user.groups,
                effective_filters=effective_filters,
                assigned_at=datetime.now(),
                assigned_by="system"
            )
            
            # Cache the mapping
            self._user_mappings_cache[user.id] = mapping
            
            # Log RLS assignment
            security_logger.log_data_access(
                user_id=user.email,
                dataset_id=self.dataset_id or "default",
                data_filters=effective_filters,
                access_level="RLS_Applied"
            )
            
            logger.debug(f"Generated RLS mapping for user {user.email}: roles={assigned_roles}")
            
            return mapping
            
        except Exception as e:
            logger.error(f"Error generating RLS mapping for user {user.email}: {e}")
            raise
    
    def _map_user_to_rls_roles(self, user: User) -> List[str]:
        """Map user's Entra ID groups to RLS roles"""
        
        # Admin users get Admin role
        if user.is_admin:
            return ["Admin"]
        
        # Map based on Entra ID groups
        mapped_roles = []
        
        for group in user.groups:
            if group == "PBI-Admin":
                mapped_roles.append("Admin")
            elif group == "PBI-RolA":
                mapped_roles.append("RolA")
            elif group == "PBI-RolB":
                mapped_roles.append("RolB")
        
        # If no specific roles, assign Public role
        if not mapped_roles:
            mapped_roles.append("Public")
        
        # Remove duplicates while preserving order
        return list(dict.fromkeys(mapped_roles))
    
    def _build_effective_filters(self, user: User, assigned_roles: List[str]) -> Dict[str, Any]:
        """Build effective filters based on assigned roles"""
        
        filters = {
            "user_context": {
                "user_email": user.email,
                "user_id": user.id,
                "is_admin": user.is_admin
            },
            "role_filters": {},
            "dynamic_filters": {},
            "table_restrictions": []
        }
        
        # Build filters for each assigned role
        for role_name in assigned_roles:
            if role_name in self._rls_roles_cache:
                role = self._rls_roles_cache[role_name]
                
                filters["role_filters"][role_name] = {
                    "expression": role.rule_expression,
                    "type": role.rule_type.value,
                    "tables": role.table_filters
                }
                
                # Add table restrictions
                filters["table_restrictions"].extend(role.table_filters)
        
        # Remove duplicate table restrictions
        filters["table_restrictions"] = list(set(filters["table_restrictions"]))
        
        # Add dynamic filters based on user attributes
        if not user.is_admin:
            filters["dynamic_filters"] = {
                "user_email_filter": f"[UserEmail] = '{user.email}'",
                "user_department_filter": self._get_user_department_filter(user),
                "access_level_filter": self._get_access_level_filter(user)
            }
        
        return filters
    
    def _get_user_department_filter(self, user: User) -> str:
        """Generate department-based filter for user"""
        
        # In a real implementation, this would query user's department
        # For now, derive from email domain or groups
        
        email_domain = user.email.split('@')[1] if '@' in user.email else ''
        
        # Example logic based on groups
        if "PBI-RolA" in user.groups:
            return "[Department] IN ('Sales', 'Marketing')"
        elif "PBI-RolB" in user.groups:
            return "[Department] IN ('Operations', 'Finance')"
        else:
            return "[Department] = 'General'"
    
    def _get_access_level_filter(self, user: User) -> str:
        """Generate access level filter for user"""
        
        if user.is_admin:
            return "1=1"  # No restrictions
        elif any(role in ["RolA", "RolB"] for role in user.roles):
            return "[AccessLevel] IN ('Public', 'Internal')"
        else:
            return "[AccessLevel] = 'Public'"
    
    async def validate_rls_configuration(self, dataset_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Validate RLS configuration in PowerBI dataset
        
        Args:
            dataset_id: Dataset ID to validate (uses default if not provided)
            
        Returns:
            Validation results
        """
        
        try:
            target_dataset_id = dataset_id or self.dataset_id
            if not target_dataset_id:
                raise ValueError("No dataset ID provided for RLS validation")
            
            # Get PowerBI access token
            powerbi_token = await self._get_service_token()
            
            # Get dataset security information
            security_info = await self._get_dataset_security(target_dataset_id, powerbi_token)
            
            # Validate roles exist in dataset
            dataset_roles = [role.get('name', '') for role in security_info.get('roles', [])]
            configured_roles = list(self._rls_roles_cache.keys())
            
            validation_result = {
                "dataset_id": target_dataset_id,
                "validation_status": "passed",
                "configured_roles": configured_roles,
                "dataset_roles": dataset_roles,
                "missing_roles": [role for role in configured_roles if role not in dataset_roles],
                "extra_roles": [role for role in dataset_roles if role not in configured_roles],
                "role_details": [],
                "recommendations": [],
                "timestamp": datetime.now().isoformat()
            }
            
            # Check each configured role
            for role_name, role_config in self._rls_roles_cache.items():
                role_detail = {
                    "name": role_name,
                    "exists_in_dataset": role_name in dataset_roles,
                    "configuration": {
                        "expression": role_config.rule_expression,
                        "type": role_config.rule_type.value,
                        "tables": role_config.table_filters,
                        "is_active": role_config.is_active
                    }
                }
                
                # Find matching dataset role
                dataset_role = next((r for r in security_info.get('roles', []) if r.get('name') == role_name), None)
                if dataset_role:
                    role_detail["dataset_configuration"] = {
                        "members": dataset_role.get('members', []),
                        "tables": dataset_role.get('tablePermissions', [])
                    }
                
                validation_result["role_details"].append(role_detail)
            
            # Generate recommendations
            if validation_result["missing_roles"]:
                validation_result["recommendations"].append(
                    f"Add missing roles to dataset: {', '.join(validation_result['missing_roles'])}"
                )
                validation_result["validation_status"] = "warning"
            
            if validation_result["extra_roles"]:
                validation_result["recommendations"].append(
                    f"Consider removing unused roles from dataset: {', '.join(validation_result['extra_roles'])}"
                )
            
            logger.info(f"RLS validation completed for dataset {target_dataset_id}: {validation_result['validation_status']}")
            
            return validation_result
            
        except Exception as e:
            logger.error(f"Error validating RLS configuration: {e}")
            return {
                "dataset_id": dataset_id,
                "validation_status": "failed",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    async def get_rls_analytics(self) -> Dict[str, Any]:
        """
        Get analytics about RLS usage and effectiveness
        
        Returns:
            RLS analytics and metrics
        """
        
        try:
            # Calculate user distribution across roles
            role_distribution = {}
            user_count_by_role = {}
            
            for user_id, mapping in self._user_mappings_cache.items():
                for role in mapping.assigned_roles:
                    if role not in role_distribution:
                        role_distribution[role] = []
                        user_count_by_role[role] = 0
                    
                    role_distribution[role].append({
                        "user_email": mapping.user_email,
                        "assigned_at": mapping.assigned_at.isoformat(),
                        "entra_groups": mapping.entra_groups
                    })
                    user_count_by_role[role] += 1
            
            # Calculate filter complexity
            filter_complexity = {}
            for role_name, role_config in self._rls_roles_cache.items():
                complexity_score = len(role_config.table_filters)
                if role_config.rule_type == RLSRuleType.DYNAMIC:
                    complexity_score += 2
                elif role_config.rule_type == RLSRuleType.CONDITIONAL:
                    complexity_score += 1
                
                filter_complexity[role_name] = {
                    "score": complexity_score,
                    "tables_affected": len(role_config.table_filters),
                    "rule_type": role_config.rule_type.value
                }
            
            analytics = {
                "summary": {
                    "total_configured_roles": len(self._rls_roles_cache),
                    "total_active_users": len(self._user_mappings_cache),
                    "most_used_role": max(user_count_by_role, key=user_count_by_role.get) if user_count_by_role else None,
                    "least_used_role": min(user_count_by_role, key=user_count_by_role.get) if user_count_by_role else None
                },
                "role_distribution": user_count_by_role,
                "role_details": {
                    role_name: {
                        "description": role.description,
                        "rule_expression": role.rule_expression,
                        "rule_type": role.rule_type.value,
                        "table_filters": role.table_filters,
                        "is_active": role.is_active,
                        "user_count": user_count_by_role.get(role_name, 0),
                        "complexity_score": filter_complexity.get(role_name, {}).get("score", 0)
                    }
                    for role_name, role in self._rls_roles_cache.items()
                },
                "user_mappings": role_distribution,
                "filter_complexity": filter_complexity,
                "performance_metrics": {
                    "cache_size": len(self._user_mappings_cache),
                    "roles_cache_size": len(self._rls_roles_cache),
                    "last_cache_update": max(
                        (mapping.assigned_at for mapping in self._user_mappings_cache.values()),
                        default=datetime.now()
                    ).isoformat()
                },
                "timestamp": datetime.now().isoformat()
            }
            
            return analytics
            
        except Exception as e:
            logger.error(f"Error generating RLS analytics: {e}")
            return {"error": str(e), "timestamp": datetime.now().isoformat()}
    
    async def test_rls_for_user(self, user: User, dataset_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Test RLS configuration for a specific user
        
        Args:
            user: User to test RLS for
            dataset_id: Dataset to test against
            
        Returns:
            RLS test results
        """
        
        try:
            # Get user's RLS mapping
            mapping = await self.get_user_rls_mapping(user)
            
            # Get dataset validation
            validation = await self.validate_rls_configuration(dataset_id)
            
            # Test each assigned role
            role_tests = []
            for role_name in mapping.assigned_roles:
                if role_name in self._rls_roles_cache:
                    role_config = self._rls_roles_cache[role_name]
                    
                    role_test = {
                        "role_name": role_name,
                        "rule_expression": role_config.rule_expression,
                        "expected_behavior": self._describe_expected_behavior(role_config, user),
                        "affected_tables": role_config.table_filters,
                        "test_status": "configured" if role_name in validation["dataset_roles"] else "missing_in_dataset"
                    }
                    
                    role_tests.append(role_test)
            
            test_result = {
                "user": {
                    "email": user.email,
                    "id": user.id,
                    "is_admin": user.is_admin,
                    "groups": user.groups
                },
                "rls_mapping": {
                    "assigned_roles": mapping.assigned_roles,
                    "effective_filters": mapping.effective_filters
                },
                "role_tests": role_tests,
                "overall_status": "pass" if all(test["test_status"] == "configured" for test in role_tests) else "fail",
                "recommendations": self._generate_test_recommendations(mapping, validation),
                "timestamp": datetime.now().isoformat()
            }
            
            logger.info(f"RLS test completed for user {user.email}: {test_result['overall_status']}")
            
            return test_result
            
        except Exception as e:
            logger.error(f"Error testing RLS for user {user.email}: {e}")
            return {
                "error": str(e),
                "user_email": user.email,
                "timestamp": datetime.now().isoformat()
            }
    
    def _describe_expected_behavior(self, role_config: RLSRole, user: User) -> str:
        """Describe what data the user should see with this role"""
        
        if role_config.name == "Admin":
            return "User should see all data without any filtering restrictions"
        elif role_config.name == "RolA":
            return "User should only see data where Region = 'A'"
        elif role_config.name == "RolB":
            return "User should only see data where Region = 'B'"
        elif role_config.name == "Dynamic":
            return f"User should only see data where UserEmail = '{user.email}'"
        elif role_config.name == "Public":
            return "User should only see publicly available data"
        else:
            return f"User should see data filtered by: {role_config.rule_expression}"
    
    def _generate_test_recommendations(self, mapping: RLSUserMapping, validation: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on test results"""
        
        recommendations = []
        
        # Check for missing roles
        missing_roles = [role for role in mapping.assigned_roles if role not in validation["dataset_roles"]]
        if missing_roles:
            recommendations.append(f"Add missing RLS roles to dataset: {', '.join(missing_roles)}")
        
        # Check for overly complex role assignments
        if len(mapping.assigned_roles) > 2:
            recommendations.append("User has multiple roles assigned - verify this is intentional")
        
        # Check for admin access
        if mapping.user_email.endswith("@admin.com") and "Admin" not in mapping.assigned_roles:
            recommendations.append("Admin user should have Admin role assigned")
        
        return recommendations
    
    async def _get_service_token(self) -> str:
        """Get PowerBI service token"""
        scope = "https://analysis.windows.net/powerbi/api/.default"
        return await entra_auth_service.get_service_principal_token(scope)
    
    async def _get_dataset_security(self, dataset_id: str, powerbi_token: str) -> Dict[str, Any]:
        """Get dataset security configuration from PowerBI"""
        
        if dataset_id in self._dataset_security_cache:
            return self._dataset_security_cache[dataset_id]
        
        try:
            # Try to get RLS roles from dataset
            url = f"{self.base_url}/groups/{self.workspace_id}/datasets/{dataset_id}/users"
            headers = {"Authorization": f"Bearer {powerbi_token}"}
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, timeout=30)
                
                if response.status_code == 200:
                    security_data = response.json()
                    self._dataset_security_cache[dataset_id] = security_data
                    return security_data
                else:
                    # Fallback - return empty structure
                    logger.warning(f"Could not retrieve dataset security info: {response.status_code}")
                    return {"roles": [], "users": []}
                    
        except Exception as e:
            logger.warning(f"Error getting dataset security: {e}")
            return {"roles": [], "users": []}


# Global service instance
rls_service = RLSService()


# Convenience functions
async def get_user_rls_mapping(user: User) -> RLSUserMapping:
    """Get RLS mapping for user"""
    return await rls_service.get_user_rls_mapping(user)


async def validate_rls_configuration(dataset_id: Optional[str] = None) -> Dict[str, Any]:
    """Validate RLS configuration"""
    return await rls_service.validate_rls_configuration(dataset_id)


async def test_user_rls(user: User, dataset_id: Optional[str] = None) -> Dict[str, Any]:
    """Test RLS for user"""
    return await rls_service.test_rls_for_user(user, dataset_id)